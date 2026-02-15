"""Payslip routes for ESS Mobile API"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import io

from models_ess.payslip import (
    PayslipSummary,
    PayslipDetail,
    PayslipListResponse,
    PayslipEarning,
    PayslipDeduction
)
from routes_ess.auth import get_current_user

router = APIRouter()


@router.get("/payslips", response_model=PayslipListResponse)
async def get_payslips(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=24),
    year: int = Query(default=None, description="Filter by year"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of payslips for the employee.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    # Build query
    query = {"employee_id": user_id, "status": {"$in": ["confirmed", "paid"]}}
    
    if year:
        query["year"] = year
    
    # Get total count
    total = await db.payroll_records.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * page_size
    records = await db.payroll_records.find(query, {"_id": 0})\
        .sort([("year", -1), ("month", -1)])\
        .skip(skip)\
        .limit(page_size)\
        .to_list(page_size)
    
    # Get currency info
    currency_symbol = "₹"
    if current_user.get("country_id"):
        country = await db.countries.find_one(
            {"id": current_user["country_id"]},
            {"_id": 0, "currency_symbol": 1}
        )
        if country:
            currency_symbol = country.get("currency_symbol", "₹")
    
    # Format response
    payslips = []
    month_names = ["", "January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    
    for record in records:
        month = record.get("month", 1)
        year_val = record.get("year", datetime.now().year)
        
        payslips.append(PayslipSummary(
            id=record["id"],
            period=f"{month_names[month]} {year_val}",
            month=month,
            year=year_val,
            gross_salary=record.get("gross_salary", 0),
            total_deductions=record.get("total_deductions", 0),
            net_salary=record.get("net_salary", 0),
            currency_symbol=currency_symbol,
            status=record.get("status", "confirmed"),
            payment_date=record.get("payment_date"),
            can_download=True
        ))
    
    return PayslipListResponse(
        payslips=payslips,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(skip + len(records)) < total
    )


@router.get("/payslips/years")
async def get_available_years(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of years with available payslips.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    years = await db.payroll_records.distinct(
        "year",
        {"employee_id": user_id, "status": {"$in": ["confirmed", "paid"]}}
    )
    
    return {"years": sorted(years, reverse=True)}


@router.get("/payslips/{payslip_id}", response_model=PayslipDetail)
async def get_payslip_detail(
    request: Request,
    payslip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed payslip information.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    # Get payroll record
    record = await db.payroll_records.find_one(
        {"id": payslip_id, "employee_id": user_id},
        {"_id": 0}
    )
    
    if not record:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    # Get employee info
    employee = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "name": 1, "email": 1, "employee_code": 1, "bank_name": 1, "bank_account_number_masked": 1}
    )
    
    # Get salary structure for earnings breakdown
    salary = await db.salary_structures.find_one(
        {"user_id": user_id, "effective_to": None},
        {"_id": 0}
    )
    
    # Get currency info
    currency = "INR"
    currency_symbol = "₹"
    if current_user.get("country_id"):
        country = await db.countries.find_one(
            {"id": current_user["country_id"]},
            {"_id": 0, "currency": 1, "currency_symbol": 1}
        )
        if country:
            currency = country.get("currency", "INR")
            currency_symbol = country.get("currency_symbol", "₹")
    
    # Build earnings breakdown
    earnings = []
    if salary:
        if salary.get("basic_salary"):
            earnings.append(PayslipEarning(name="Basic Salary", amount=salary["basic_salary"]))
        if salary.get("hra"):
            earnings.append(PayslipEarning(name="HRA", amount=salary["hra"]))
        if salary.get("conveyance_allowance"):
            earnings.append(PayslipEarning(name="Conveyance", amount=salary["conveyance_allowance"]))
        if salary.get("medical_allowance"):
            earnings.append(PayslipEarning(name="Medical", amount=salary["medical_allowance"]))
        if salary.get("special_allowance"):
            earnings.append(PayslipEarning(name="Special Allowance", amount=salary["special_allowance"]))
        if salary.get("variable_pay"):
            earnings.append(PayslipEarning(name="Variable Pay", amount=salary["variable_pay"]))
    
    # Add overtime and incentive if applicable
    if record.get("overtime_pay", 0) > 0:
        earnings.append(PayslipEarning(name="Overtime Pay", amount=record["overtime_pay"]))
    if record.get("incentive_amount", 0) > 0:
        earnings.append(PayslipEarning(name="Incentive", amount=record["incentive_amount"]))
    
    # Build deductions breakdown
    deductions = []
    if record.get("pf_deduction", 0) > 0:
        deductions.append(PayslipDeduction(name="Provident Fund", amount=record["pf_deduction"]))
    if record.get("professional_tax", 0) > 0:
        deductions.append(PayslipDeduction(name="Professional Tax", amount=record["professional_tax"]))
    if record.get("tds", 0) > 0:
        deductions.append(PayslipDeduction(name="Income Tax (TDS)", amount=record["tds"]))
    if record.get("esi", 0) > 0:
        deductions.append(PayslipDeduction(name="ESI", amount=record["esi"]))
    if record.get("attendance_deduction", 0) > 0:
        deductions.append(PayslipDeduction(
            name=f"LOP Deduction ({record.get('lop_days', 0)} days)",
            amount=record["attendance_deduction"]
        ))
    if record.get("other_deductions", 0) > 0:
        deductions.append(PayslipDeduction(name="Other Deductions", amount=record["other_deductions"]))
    
    month_names = ["", "January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    
    month = record.get("month", 1)
    year_val = record.get("year", datetime.now().year)
    
    return PayslipDetail(
        id=record["id"],
        employee_id=user_id,
        employee_name=employee.get("name", "") if employee else "",
        employee_code=employee.get("employee_code", "") if employee else "",
        period=f"{month_names[month]} {year_val}",
        month=month,
        year=year_val,
        company_name="WiseDrive Technologies Pvt Ltd",
        company_address=None,
        earnings=earnings,
        total_earnings=record.get("gross_salary", 0),
        deductions=deductions,
        total_deductions=record.get("total_deductions", 0),
        net_salary=record.get("net_salary", 0),
        currency=currency,
        currency_symbol=currency_symbol,
        working_days=record.get("working_days", 0),
        days_worked=record.get("present_days", 0),
        lop_days=record.get("lop_days", 0),
        overtime_days=record.get("overtime_days", 0),
        overtime_pay=record.get("overtime_pay", 0),
        incentive_amount=record.get("incentive_amount", 0),
        status=record.get("status", "confirmed"),
        payment_date=record.get("payment_date"),
        payment_reference=record.get("payment_reference"),
        bank_name=employee.get("bank_name") if employee else None,
        account_number_masked=employee.get("bank_account_number_masked") if employee else None,
        pdf_url=record.get("payslip_url")
    )


@router.get("/payslips/{payslip_id}/download")
async def download_payslip(
    request: Request,
    payslip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Download payslip PDF.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    # Get payroll record
    record = await db.payroll_records.find_one(
        {"id": payslip_id, "employee_id": user_id},
        {"_id": 0, "payslip_url": 1, "month": 1, "year": 1}
    )
    
    if not record:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    payslip_url = record.get("payslip_url")
    
    if not payslip_url:
        raise HTTPException(status_code=404, detail="Payslip PDF not generated yet")
    
    # If it's a local file path
    if payslip_url.startswith("/app/storage/"):
        try:
            with open(payslip_url, "rb") as f:
                content = f.read()
            
            month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            month = record.get("month", 1)
            year = record.get("year", datetime.now().year)
            filename = f"payslip_{month_names[month]}_{year}.pdf"
            
            return StreamingResponse(
                io.BytesIO(content),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Payslip file not found")
    
    # For external URLs, redirect
    return {"download_url": payslip_url}
