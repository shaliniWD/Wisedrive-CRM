"""Payroll Service - Payroll generation, payment marking, payslip creation"""
from datetime import datetime, timezone
from typing import Optional, List, Dict
import calendar
import uuid
import os


class PayrollService:
    """Service for managing payroll operations"""
    
    def __init__(self, db, attendance_service=None, storage_service=None):
        self.db = db
        self.attendance_service = attendance_service
        self.storage_service = storage_service
    
    # ==================== PAYROLL GENERATION ====================
    
    async def generate_payroll(
        self,
        employee_id: str,
        month: int,
        year: int,
        generated_by: str,
        generated_by_name: str
    ) -> dict:
        """Generate payroll for a single employee"""
        
        # Check if payroll already exists
        existing = await self.db.payroll_records.find_one({
            "employee_id": employee_id,
            "month": month,
            "year": year
        })
        if existing:
            raise ValueError(f"Payroll already exists for {month}/{year}")
        
        # Get employee details
        employee = await self.db.users.find_one(
            {"id": employee_id, "is_active": True},
            {"_id": 0}
        )
        if not employee:
            raise ValueError("Employee not found or inactive")
        
        # Get salary structure
        salary = await self.db.salary_structures.find_one(
            {"user_id": employee_id, "effective_to": None},
            {"_id": 0}
        )
        if not salary:
            raise ValueError("Salary structure not found")
        
        # Get attendance summary
        if self.attendance_service:
            attendance = await self.attendance_service.get_attendance_summary(
                employee_id, month, year
            )
        else:
            attendance = {
                "working_days": calendar.monthrange(year, month)[1] - self._count_sundays(year, month),
                "present_days": 0,
                "pending_days": 0,
                "absent_days": 0,
                "approved_days": 0,
                "unapproved_absent_days": 0,
                "total_hours_worked": 0
            }
        
        # Get department name
        dept_name = None
        if employee.get("department_id"):
            dept = await self.db.departments.find_one({"id": employee["department_id"]}, {"_id": 0, "name": 1})
            dept_name = dept.get("name") if dept else None
        
        # Get country currency
        currency = "INR"
        currency_symbol = "₹"
        if employee.get("country_id"):
            country = await self.db.countries.find_one(
                {"id": employee["country_id"]}, 
                {"_id": 0, "currency": 1, "currency_symbol": 1}
            )
            if country:
                currency = country.get("currency", "INR")
                currency_symbol = country.get("currency_symbol", "₹")
        
        # Check if mechanic/freelancer
        is_freelancer = False
        if employee.get("role_id"):
            role = await self.db.roles.find_one({"id": employee["role_id"]}, {"_id": 0, "code": 1})
            is_freelancer = role and role.get("code") == "MECHANIC"
        
        # Calculate salary components
        basic = salary.get("basic_salary", 0)
        hra = salary.get("hra", 0)
        conveyance = salary.get("conveyance_allowance", 0)
        medical = salary.get("medical_allowance", 0)
        special = salary.get("special_allowance", 0)
        variable = salary.get("variable_pay", 0)
        
        gross = basic + hra + conveyance + medical + special + variable
        
        # Statutory deductions
        pf_employee = salary.get("pf_employee", 0)
        pf_employer = salary.get("pf_employer", 0)
        professional_tax = salary.get("professional_tax", 0)
        income_tax = salary.get("income_tax", 0)
        other_deductions = salary.get("other_deductions", 0)
        total_statutory = pf_employee + professional_tax + income_tax + other_deductions
        
        # Attendance deduction
        working_days = attendance.get("working_days", 22)
        per_day_salary = gross / working_days if working_days > 0 else 0
        unapproved_absent = attendance.get("unapproved_absent_days", 0)
        attendance_deduction = per_day_salary * unapproved_absent
        
        # Net salary
        net = gross - total_statutory - attendance_deduction
        
        # For freelancers/mechanics
        inspections = 0
        price_per_inspection = salary.get("price_per_inspection", 0)
        inspection_pay = 0
        if is_freelancer:
            # Count completed inspections for this month
            start_date = f"{year}-{str(month).zfill(2)}-01"
            last_day = calendar.monthrange(year, month)[1]
            end_date = f"{year}-{str(month).zfill(2)}-{last_day}"
            
            inspections = await self.db.inspections.count_documents({
                "mechanic_id": employee_id,
                "inspection_status": "COMPLETED",
                "completed_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
            })
            inspection_pay = inspections * price_per_inspection
            net = inspection_pay  # Freelancers paid per inspection
        
        now = datetime.now(timezone.utc).isoformat()
        
        payroll = {
            "id": str(uuid.uuid4()),
            "employee_id": employee_id,
            "employee_name": employee.get("name", ""),
            "employee_code": employee.get("employee_code"),
            "department_name": dept_name,
            "month": month,
            "year": year,
            
            # Salary snapshot
            "basic_salary": basic,
            "hra": hra,
            "conveyance_allowance": conveyance,
            "medical_allowance": medical,
            "special_allowance": special,
            "variable_pay": variable,
            "gross_salary": gross,
            
            # Deductions
            "pf_employee": pf_employee,
            "pf_employer": pf_employer,
            "professional_tax": professional_tax,
            "income_tax": income_tax,
            "other_deductions": other_deductions,
            "total_statutory_deductions": total_statutory,
            
            # Attendance
            "working_days_in_month": working_days,
            "per_day_salary": round(per_day_salary, 2),
            "unapproved_absent_days": unapproved_absent,
            "attendance_deduction": round(attendance_deduction, 2),
            
            # Attendance summary
            "present_days": attendance.get("present_days", 0),
            "pending_days": attendance.get("pending_days", 0),
            "absent_days": attendance.get("absent_days", 0),
            "approved_days": attendance.get("approved_days", 0),
            "total_hours_worked": attendance.get("total_hours_worked", 0),
            
            # Net
            "net_salary": round(net, 2),
            
            # Freelancer
            "is_freelancer": is_freelancer,
            "inspections_completed": inspections,
            "price_per_inspection": price_per_inspection,
            "total_inspection_pay": inspection_pay,
            
            # Currency
            "currency": currency,
            "currency_symbol": currency_symbol,
            
            # Generation metadata
            "generated_at": now,
            "generated_by": generated_by,
            "generated_by_name": generated_by_name,
            
            # Payment tracking
            "payment_status": "GENERATED",
            "payment_date": None,
            "payment_by": None,
            "payment_by_name": None,
            "payment_mode": None,
            "transaction_reference": None,
            "payment_timestamp": None,
            
            # Bank details snapshot
            "bank_name": employee.get("bank_name"),
            "bank_account_number": employee.get("bank_account_number"),
            "ifsc_code": employee.get("ifsc_code"),
            
            # Immutability
            "is_locked": True,
            "version": 1,
            
            "payslip_path": None,
            "payslip_generated_at": None,
            "created_at": now
        }
        
        await self.db.payroll_records.insert_one(payroll)
        payroll.pop("_id", None)
        
        # Log audit
        await self._log_audit(
            "payroll", payroll["id"], "generate",
            generated_by, {"employee_id": employee_id, "month": month, "year": year, "net_salary": net}
        )
        
        return payroll
    
    async def bulk_generate_payroll(
        self,
        month: int,
        year: int,
        generated_by: str,
        generated_by_name: str,
        employee_ids: Optional[List[str]] = None,
        country_id: Optional[str] = None
    ) -> dict:
        """Generate payroll for multiple employees"""
        # Get employees
        query = {"is_active": True}
        if employee_ids:
            query["id"] = {"$in": employee_ids}
        if country_id:
            query["country_id"] = country_id
        
        employees = await self.db.users.find(query, {"_id": 0, "id": 1}).to_list(10000)
        
        results = {
            "success": [],
            "failed": [],
            "skipped": []
        }
        
        for emp in employees:
            try:
                # Check if already exists
                existing = await self.db.payroll_records.find_one({
                    "employee_id": emp["id"],
                    "month": month,
                    "year": year
                })
                if existing:
                    results["skipped"].append({"employee_id": emp["id"], "reason": "Already exists"})
                    continue
                
                payroll = await self.generate_payroll(
                    emp["id"], month, year, generated_by, generated_by_name
                )
                results["success"].append({"employee_id": emp["id"], "payroll_id": payroll["id"]})
            except Exception as e:
                results["failed"].append({"employee_id": emp["id"], "error": str(e)})
        
        return results
    
    # ==================== PAYMENT MARKING ====================
    
    async def mark_as_paid(
        self,
        payroll_id: str,
        transaction_reference: str,
        payment_date: str,
        payment_mode: str,
        paid_by: str,
        paid_by_name: str,
        notes: Optional[str] = None
    ) -> dict:
        """Mark payroll as paid - requires transaction reference"""
        
        payroll = await self.db.payroll_records.find_one(
            {"id": payroll_id},
            {"_id": 0}
        )
        if not payroll:
            raise ValueError("Payroll not found")
        
        if payroll.get("payment_status") == "PAID":
            raise ValueError("Payroll already marked as paid")
        
        if not transaction_reference:
            raise ValueError("Transaction reference is required")
        
        now = datetime.now(timezone.utc).isoformat()
        
        update_data = {
            "payment_status": "PAID",
            "payment_date": payment_date,
            "payment_by": paid_by,
            "payment_by_name": paid_by_name,
            "payment_mode": payment_mode,
            "transaction_reference": transaction_reference,
            "payment_timestamp": now
        }
        
        await self.db.payroll_records.update_one(
            {"id": payroll_id},
            {"$set": update_data}
        )
        
        # Log audit
        await self._log_audit(
            "payroll", payroll_id, "payment_marked",
            paid_by, {
                "transaction_reference": transaction_reference,
                "payment_mode": payment_mode,
                "amount": payroll.get("net_salary")
            }
        )
        
        payroll.update(update_data)
        return payroll
    
    # ==================== ADJUSTMENTS ====================
    
    async def create_adjustment(
        self,
        payroll_id: str,
        adjustment_type: str,
        amount: float,
        reason: str,
        created_by: str,
        created_by_name: str,
        notes: Optional[str] = None
    ) -> dict:
        """Create adjustment record (original payroll remains immutable)"""
        
        payroll = await self.db.payroll_records.find_one(
            {"id": payroll_id},
            {"_id": 0}
        )
        if not payroll:
            raise ValueError("Payroll not found")
        
        now = datetime.now(timezone.utc).isoformat()
        
        adjustment = {
            "id": str(uuid.uuid4()),
            "payroll_id": payroll_id,
            "employee_id": payroll["employee_id"],
            "month": payroll["month"],
            "year": payroll["year"],
            "adjustment_type": adjustment_type,
            "amount": amount,
            "reason": reason,
            "notes": notes,
            "created_at": now,
            "created_by": created_by,
            "created_by_name": created_by_name,
            "approved_by": None,
            "approved_at": None,
            "is_paid": False,
            "paid_with_payroll_id": None
        }
        
        await self.db.payroll_adjustments.insert_one(adjustment)
        adjustment.pop("_id", None)
        
        # Log audit
        await self._log_audit(
            "payroll_adjustment", adjustment["id"], "create",
            created_by, {"payroll_id": payroll_id, "type": adjustment_type, "amount": amount}
        )
        
        return adjustment
    
    # ==================== PAYSLIP GENERATION ====================
    
    async def generate_payslip(self, payroll_id: str) -> dict:
        """Generate PDF payslip and store in object storage"""
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch, cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
        import io
        
        payroll = await self.db.payroll_records.find_one(
            {"id": payroll_id},
            {"_id": 0}
        )
        if not payroll:
            raise ValueError("Payroll not found")
        
        # Create PDF buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1e40af'),
            alignment=TA_CENTER,
            spaceAfter=20
        )
        
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.grey,
            alignment=TA_CENTER,
            spaceAfter=20
        )
        
        # Header
        elements.append(Paragraph("WiseDrive Technologies Private Limited", title_style))
        elements.append(Paragraph("PAYSLIP", subtitle_style))
        
        # Pay period
        month_name = calendar.month_name[payroll["month"]]
        elements.append(Paragraph(f"Pay Period: {month_name} {payroll['year']}", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        # Employee Info
        emp_data = [
            ["Employee Name:", payroll.get("employee_name", ""), "Employee Code:", payroll.get("employee_code", "-")],
            ["Department:", payroll.get("department_name", "-"), "Bank Account:", self._mask_account(payroll.get("bank_account_number", ""))],
        ]
        
        emp_table = Table(emp_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
        emp_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(emp_table)
        elements.append(Spacer(1, 20))
        
        # Earnings
        currency = payroll.get("currency_symbol", "₹")
        
        earnings_data = [["Earnings", "Amount"]]
        if payroll.get("basic_salary", 0) > 0:
            earnings_data.append(["Basic Salary", f"{currency}{payroll['basic_salary']:,.2f}"])
        if payroll.get("hra", 0) > 0:
            earnings_data.append(["House Rent Allowance (HRA)", f"{currency}{payroll['hra']:,.2f}"])
        if payroll.get("conveyance_allowance", 0) > 0:
            earnings_data.append(["Conveyance Allowance", f"{currency}{payroll['conveyance_allowance']:,.2f}"])
        if payroll.get("medical_allowance", 0) > 0:
            earnings_data.append(["Medical Allowance", f"{currency}{payroll['medical_allowance']:,.2f}"])
        if payroll.get("special_allowance", 0) > 0:
            earnings_data.append(["Special Allowance", f"{currency}{payroll['special_allowance']:,.2f}"])
        if payroll.get("variable_pay", 0) > 0:
            earnings_data.append(["Variable Pay / Incentives", f"{currency}{payroll['variable_pay']:,.2f}"])
        earnings_data.append(["Gross Earnings", f"{currency}{payroll.get('gross_salary', 0):,.2f}"])
        
        earnings_table = Table(earnings_data, colWidths=[4*inch, 2.5*inch])
        earnings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dcfce7')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(earnings_table)
        elements.append(Spacer(1, 15))
        
        # Deductions
        deductions_data = [["Deductions", "Amount"]]
        if payroll.get("pf_employee", 0) > 0:
            deductions_data.append(["Provident Fund (Employee)", f"{currency}{payroll['pf_employee']:,.2f}"])
        if payroll.get("professional_tax", 0) > 0:
            deductions_data.append(["Professional Tax", f"{currency}{payroll['professional_tax']:,.2f}"])
        if payroll.get("income_tax", 0) > 0:
            deductions_data.append(["Income Tax (TDS)", f"{currency}{payroll['income_tax']:,.2f}"])
        if payroll.get("other_deductions", 0) > 0:
            deductions_data.append(["Other Deductions", f"{currency}{payroll['other_deductions']:,.2f}"])
        if payroll.get("attendance_deduction", 0) > 0:
            deductions_data.append([f"Attendance Deduction ({payroll.get('unapproved_absent_days', 0)} days)", f"{currency}{payroll['attendance_deduction']:,.2f}"])
        
        total_deductions = payroll.get("total_statutory_deductions", 0) + payroll.get("attendance_deduction", 0)
        deductions_data.append(["Total Deductions", f"{currency}{total_deductions:,.2f}"])
        
        deductions_table = Table(deductions_data, colWidths=[4*inch, 2.5*inch])
        deductions_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fee2e2')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(deductions_table)
        elements.append(Spacer(1, 20))
        
        # Net Pay
        net_data = [["NET PAY", f"{currency}{payroll.get('net_salary', 0):,.2f}"]]
        net_table = Table(net_data, colWidths=[4*inch, 2.5*inch])
        net_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#dbeafe')),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 14),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(net_table)
        elements.append(Spacer(1, 20))
        
        # Attendance Summary
        att_data = [
            ["Attendance Summary", ""],
            ["Working Days", str(payroll.get("working_days_in_month", 0))],
            ["Days Present", str(payroll.get("present_days", 0))],
            ["Days Absent", str(payroll.get("absent_days", 0))],
            ["Total Hours Worked", f"{payroll.get('total_hours_worked', 0):.1f} hrs"],
        ]
        att_table = Table(att_data, colWidths=[4*inch, 2.5*inch])
        att_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(att_table)
        elements.append(Spacer(1, 30))
        
        # Footer
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER
        )
        elements.append(Paragraph("This is a computer-generated payslip. No signature required.", footer_style))
        elements.append(Paragraph("© WiseDrive Technologies Private Limited", footer_style))
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        # Store PDF
        filename = f"{payroll['employee_id']}_{payroll['month']}_{payroll['year']}.pdf"
        
        if self.storage_service:
            path = await self.storage_service.upload_payslip(
                pdf_bytes, filename, payroll['year'], payroll['month']
            )
        else:
            # Fallback to local storage for dev
            local_dir = f"/app/storage/payslips/{payroll['year']}/{str(payroll['month']).zfill(2)}"
            os.makedirs(local_dir, exist_ok=True)
            path = f"{local_dir}/{filename}"
            with open(path, 'wb') as f:
                f.write(pdf_bytes)
        
        # Update payroll record
        now = datetime.now(timezone.utc).isoformat()
        await self.db.payroll_records.update_one(
            {"id": payroll_id},
            {"$set": {"payslip_path": path, "payslip_generated_at": now}}
        )
        
        return {
            "payroll_id": payroll_id,
            "payslip_path": path,
            "generated_at": now
        }
    
    def _mask_account(self, account: str) -> str:
        """Mask bank account number"""
        if not account or len(account) < 4:
            return "-"
        return "X" * (len(account) - 4) + account[-4:]
    
    # ==================== QUERIES ====================
    
    async def get_payroll_by_id(self, payroll_id: str) -> Optional[dict]:
        """Get single payroll record"""
        payroll = await self.db.payroll_records.find_one(
            {"id": payroll_id},
            {"_id": 0}
        )
        return payroll
    
    async def get_employee_payroll_history(
        self,
        employee_id: str,
        year: Optional[int] = None
    ) -> List[dict]:
        """Get payroll history for an employee"""
        query = {"employee_id": employee_id}
        if year:
            query["year"] = year
        
        records = await self.db.payroll_records.find(
            query, {"_id": 0}
        ).sort([("year", -1), ("month", -1)]).to_list(100)
        
        return records
    
    async def get_monthly_payroll(
        self,
        month: int,
        year: int,
        country_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[dict]:
        """Get all payroll records for a month"""
        query = {"month": month, "year": year}
        if status:
            query["payment_status"] = status
        
        records = await self.db.payroll_records.find(
            query, {"_id": 0}
        ).sort("employee_name", 1).to_list(10000)
        
        # Filter by country if needed
        if country_id:
            emp_ids = await self.db.users.find(
                {"country_id": country_id},
                {"_id": 0, "id": 1}
            ).to_list(10000)
            emp_id_set = {e["id"] for e in emp_ids}
            records = [r for r in records if r["employee_id"] in emp_id_set]
        
        return records
    
    async def get_payroll_summary(
        self,
        month: int,
        year: int,
        country_id: Optional[str] = None
    ) -> dict:
        """Get monthly payroll summary"""
        records = await self.get_monthly_payroll(month, year, country_id)
        
        total_gross = sum(r.get("gross_salary", 0) for r in records)
        total_deductions = sum(r.get("total_statutory_deductions", 0) + r.get("attendance_deduction", 0) for r in records)
        total_net = sum(r.get("net_salary", 0) for r in records)
        
        paid = [r for r in records if r.get("payment_status") == "PAID"]
        pending = [r for r in records if r.get("payment_status") != "PAID"]
        
        return {
            "month": month,
            "year": year,
            "total_employees": len(records),
            "total_gross_salary": round(total_gross, 2),
            "total_deductions": round(total_deductions, 2),
            "total_net_salary": round(total_net, 2),
            "paid_count": len(paid),
            "pending_count": len(pending),
            "total_paid_amount": round(sum(r.get("net_salary", 0) for r in paid), 2),
            "total_pending_amount": round(sum(r.get("net_salary", 0) for r in pending), 2)
        }
    
    async def get_adjustments(self, payroll_id: str) -> List[dict]:
        """Get adjustments for a payroll record"""
        adjustments = await self.db.payroll_adjustments.find(
            {"payroll_id": payroll_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return adjustments
    
    # ==================== HELPERS ====================
    
    def _count_sundays(self, year: int, month: int) -> int:
        """Count Sundays in a month"""
        c = calendar.Calendar()
        return sum(1 for day in c.itermonthdays2(year, month) if day[0] != 0 and day[1] == 6)
    
    async def _log_audit(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        user_id: str,
        details: dict
    ):
        """Log audit entry"""
        import uuid
        
        # Get user name
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "name": 1})
        user_name = user.get("name", "Unknown") if user else "Unknown"
        
        audit = {
            "id": str(uuid.uuid4()),
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "user_id": user_id,
            "user_name": user_name,
            "new_values": details,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.audit_logs.insert_one(audit)
    
    # ==================== BATCH-BASED PAYROLL (NEW GOVERNANCE) ====================
    
    async def preview_payroll(
        self,
        month: int,
        year: int,
        country_id: str,
        user_id: str
    ) -> dict:
        """
        Generate payroll preview (no DB save).
        Returns editable data for HR to review before creating batch.
        """
        # Get country info
        country = await self.db.countries.find_one({"id": country_id}, {"_id": 0})
        if not country:
            raise ValueError("Country not found")
        
        currency = country.get("currency", "INR")
        currency_symbol = country.get("currency_symbol", "₹")
        
        # Get all eligible employees
        # Criteria: is_active=True, payroll_active=True (if field exists), country_id matches
        query = {
            "is_active": True,
            "country_id": country_id,
            "payroll_active": {"$ne": False}  # Include employees where payroll_active is True or not set
        }
        
        employees = await self.db.users.find(query, {"_id": 0}).to_list(10000)
        
        # Filter employees who joined before month end
        last_day = calendar.monthrange(year, month)[1]
        month_end = f"{year}-{str(month).zfill(2)}-{last_day}"
        
        eligible_employees = []
        for emp in employees:
            # Skip if payroll_active is explicitly False
            if emp.get("payroll_active") is False:
                continue
            
            join_date = emp.get("joining_date", "")
            if join_date and join_date <= month_end:
                eligible_employees.append(emp)
            elif not join_date:
                eligible_employees.append(emp)
        
        # Check for existing batch
        existing_batch = await self.db.payroll_batches.find_one({
            "month": month,
            "year": year,
            "country_id": country_id
        })
        if existing_batch:
            raise ValueError(f"Payroll batch already exists for {month}/{year}. Status: {existing_batch.get('status')}")
        
        # Calculate payroll preview for each employee
        preview_records = []
        total_gross = 0
        total_statutory = 0
        total_attendance = 0
        total_other = 0
        total_net = 0
        
        working_days = calendar.monthrange(year, month)[1] - self._count_sundays(year, month)
        
        for emp in eligible_employees:
            record = await self._calculate_employee_payroll(
                emp, month, year, working_days, currency, currency_symbol
            )
            preview_records.append(record)
            
            total_gross += record["gross_salary"]
            total_statutory += record["total_statutory_deductions"]
            total_attendance += record["attendance_deduction"]
            total_other += record["other_deductions"]
            total_net += record["net_salary"]
        
        return {
            "month": month,
            "year": year,
            "country_id": country_id,
            "country_name": country.get("name"),
            "currency": currency,
            "currency_symbol": currency_symbol,
            "working_days": working_days,
            "employee_count": len(preview_records),
            "total_gross": round(total_gross, 2),
            "total_statutory_deductions": round(total_statutory, 2),
            "total_attendance_deductions": round(total_attendance, 2),
            "total_other_deductions": round(total_other, 2),
            "total_net": round(total_net, 2),
            "records": preview_records
        }
    
    async def _calculate_employee_payroll(
        self,
        employee: dict,
        month: int,
        year: int,
        working_days: int,
        currency: str,
        currency_symbol: str
    ) -> dict:
        """Calculate payroll for a single employee (for preview/batch creation)"""
        
        # Get salary structure
        salary = await self.db.salary_structures.find_one(
            {"user_id": employee["id"], "effective_to": None},
            {"_id": 0}
        )
        
        # Get department name
        dept_name = None
        if employee.get("department_id"):
            dept = await self.db.departments.find_one({"id": employee["department_id"]}, {"_id": 0, "name": 1})
            dept_name = dept.get("name") if dept else None
        
        # Check if mechanic/freelancer
        is_freelancer = False
        if employee.get("role_id"):
            role = await self.db.roles.find_one({"id": employee["role_id"]}, {"_id": 0, "code": 1})
            is_freelancer = role and role.get("code") == "MECHANIC"
        
        # Calculate salary components
        basic = salary.get("basic_salary", 0) if salary else 0
        hra = salary.get("hra", 0) if salary else 0
        conveyance = salary.get("conveyance_allowance", 0) if salary else 0
        medical = salary.get("medical_allowance", 0) if salary else 0
        special = salary.get("special_allowance", 0) if salary else 0
        variable = salary.get("variable_pay", 0) if salary else 0
        
        gross = basic + hra + conveyance + medical + special + variable
        
        # Statutory deductions (from salary structure)
        pf_employee = salary.get("pf_employee", 0) if salary else 0
        pf_employer = salary.get("pf_employer", 0) if salary else 0
        professional_tax = salary.get("professional_tax", 0) if salary else 0
        income_tax = salary.get("income_tax", 0) if salary else 0
        esi = salary.get("esi", 0) if salary else 0
        other_statutory = salary.get("other_statutory", 0) if salary else 0
        total_statutory = pf_employee + professional_tax + income_tax + esi + other_statutory
        
        # Get attendance summary
        if self.attendance_service:
            attendance = await self.attendance_service.get_attendance_summary(
                employee["id"], month, year
            )
        else:
            attendance = {
                "working_days": working_days,
                "present_days": working_days,
                "pending_days": 0,
                "absent_days": 0,
                "approved_leave_days": 0,
                "unapproved_absent_days": 0,
                "total_hours_worked": 0
            }
        
        # Calculate attendance deduction
        # Only unapproved absences deduct salary
        per_day_salary = gross / working_days if working_days > 0 else 0
        unapproved_absent = attendance.get("unapproved_absent_days", 0)
        attendance_deduction = round(per_day_salary * unapproved_absent, 2)
        
        # Other deductions (editable - starts at 0)
        other_deductions = 0
        
        # Total deductions
        total_deductions = total_statutory + attendance_deduction + other_deductions
        
        # Net salary
        net = round(gross - total_deductions, 2)
        
        # For freelancers/mechanics
        inspections = 0
        price_per_inspection = salary.get("price_per_inspection", 0) if salary else 0
        inspection_pay = 0
        if is_freelancer:
            start_date = f"{year}-{str(month).zfill(2)}-01"
            last_day = calendar.monthrange(year, month)[1]
            end_date = f"{year}-{str(month).zfill(2)}-{last_day}"
            
            inspections = await self.db.inspections.count_documents({
                "mechanic_id": employee["id"],
                "inspection_status": "COMPLETED",
                "completed_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
            })
            inspection_pay = inspections * price_per_inspection
            net = inspection_pay
        
        return {
            "employee_id": employee["id"],
            "employee_name": employee.get("name", ""),
            "employee_code": employee.get("employee_code"),
            "department_name": dept_name,
            "country_id": employee.get("country_id"),
            "month": month,
            "year": year,
            
            # Salary snapshot (NOT EDITABLE)
            "basic_salary": basic,
            "hra": hra,
            "conveyance_allowance": conveyance,
            "medical_allowance": medical,
            "special_allowance": special,
            "variable_pay": variable,
            "gross_salary": gross,
            
            # Statutory deductions (EDITABLE)
            "pf_employee": pf_employee,
            "pf_employer": pf_employer,
            "professional_tax": professional_tax,
            "income_tax": income_tax,
            "esi": esi,
            "other_statutory": other_statutory,
            "total_statutory_deductions": round(total_statutory, 2),
            
            # Attendance deduction (AUTO - not editable unless override)
            "working_days_in_month": working_days,
            "per_day_salary": round(per_day_salary, 2),
            "present_days": attendance.get("present_days", 0),
            "pending_days": attendance.get("pending_days", 0),
            "absent_days": attendance.get("absent_days", 0),
            "approved_leave_days": attendance.get("approved_leave_days", 0),
            "unapproved_absent_days": unapproved_absent,
            "attendance_deduction": attendance_deduction,
            "attendance_override": False,
            "total_hours_worked": attendance.get("total_hours_worked", 0),
            
            # Other deductions (EDITABLE)
            "other_deductions": other_deductions,
            "other_deductions_reason": None,
            
            # Total deductions
            "total_deductions": round(total_deductions, 2),
            
            # Net salary (AUTO CALCULATED)
            "net_salary": net,
            
            # Freelancer
            "is_freelancer": is_freelancer,
            "inspections_completed": inspections,
            "price_per_inspection": price_per_inspection,
            "total_inspection_pay": inspection_pay,
            
            # Currency
            "currency": currency,
            "currency_symbol": currency_symbol,
            
            # Bank details
            "bank_name": employee.get("bank_name"),
            "bank_account_number": employee.get("bank_account_number"),
            "ifsc_code": employee.get("ifsc_code"),
        }
    
    async def create_batch(
        self,
        month: int,
        year: int,
        country_id: str,
        records: List[dict],
        created_by: str,
        created_by_name: str
    ) -> dict:
        """
        Create a DRAFT payroll batch with records.
        Batch can be edited until confirmed.
        """
        # Validate no existing batch
        existing = await self.db.payroll_batches.find_one({
            "month": month,
            "year": year,
            "country_id": country_id
        })
        if existing:
            raise ValueError(f"Batch already exists. ID: {existing.get('id')}, Status: {existing.get('status')}")
        
        # Get country info
        country = await self.db.countries.find_one({"id": country_id}, {"_id": 0})
        if not country:
            raise ValueError("Country not found")
        
        now = datetime.now(timezone.utc).isoformat()
        batch_id = str(uuid.uuid4())
        
        # Calculate totals
        total_gross = sum(r.get("gross_salary", 0) for r in records)
        total_statutory = sum(r.get("total_statutory_deductions", 0) for r in records)
        total_attendance = sum(r.get("attendance_deduction", 0) for r in records)
        total_other = sum(r.get("other_deductions", 0) for r in records)
        total_net = sum(r.get("net_salary", 0) for r in records)
        
        # Create batch
        batch = {
            "id": batch_id,
            "month": month,
            "year": year,
            "country_id": country_id,
            "country_name": country.get("name"),
            "status": "DRAFT",
            "employee_count": len(records),
            "total_gross": round(total_gross, 2),
            "total_statutory_deductions": round(total_statutory, 2),
            "total_attendance_deductions": round(total_attendance, 2),
            "total_other_deductions": round(total_other, 2),
            "total_net": round(total_net, 2),
            "generated_by": created_by,
            "generated_by_name": created_by_name,
            "generated_at": now,
            "currency": country.get("currency", "INR"),
            "currency_symbol": country.get("currency_symbol", "₹"),
            "created_at": now
        }
        
        await self.db.payroll_batches.insert_one(batch)
        
        # Create payroll records linked to batch
        for record in records:
            record["id"] = str(uuid.uuid4())
            record["batch_id"] = batch_id
            record["is_locked"] = False  # Editable in DRAFT
            record["payment_status"] = "GENERATED"
            record["generated_at"] = now
            record["generated_by"] = created_by
            record["generated_by_name"] = created_by_name
            record["created_at"] = now
            record["version"] = 1
            
            await self.db.payroll_records.insert_one(record)
        
        batch.pop("_id", None)
        
        # Log audit
        await self._log_audit(
            "payroll_batch", batch_id, "create",
            created_by, {"month": month, "year": year, "country_id": country_id, "employee_count": len(records)}
        )
        
        return batch
    
    async def update_batch_record(
        self,
        batch_id: str,
        record_id: str,
        updates: dict,
        updated_by: str,
        updated_by_name: str
    ) -> dict:
        """
        Update a payroll record in a DRAFT batch.
        Only certain fields are editable.
        """
        # Verify batch is DRAFT
        batch = await self.db.payroll_batches.find_one({"id": batch_id}, {"_id": 0})
        if not batch:
            raise ValueError("Batch not found")
        if batch.get("status") != "DRAFT":
            raise ValueError(f"Cannot edit batch in {batch.get('status')} status. Only DRAFT batches are editable.")
        
        # Get record
        record = await self.db.payroll_records.find_one({"id": record_id, "batch_id": batch_id}, {"_id": 0})
        if not record:
            raise ValueError("Record not found in this batch")
        
        # Only allow updating specific fields
        allowed_fields = [
            "pf_employee", "professional_tax", "income_tax", "esi", "other_statutory",
            "attendance_override", "attendance_deduction", "attendance_override_reason",
            "other_deductions", "other_deductions_reason"
        ]
        
        update_data = {}
        for field in allowed_fields:
            if field in updates and updates[field] is not None:
                update_data[field] = updates[field]
        
        if not update_data:
            raise ValueError("No valid fields to update")
        
        # Recalculate totals
        pf = update_data.get("pf_employee", record.get("pf_employee", 0))
        pt = update_data.get("professional_tax", record.get("professional_tax", 0))
        tds = update_data.get("income_tax", record.get("income_tax", 0))
        esi = update_data.get("esi", record.get("esi", 0))
        other_stat = update_data.get("other_statutory", record.get("other_statutory", 0))
        total_statutory = pf + pt + tds + esi + other_stat
        
        attendance_ded = update_data.get("attendance_deduction", record.get("attendance_deduction", 0))
        other_ded = update_data.get("other_deductions", record.get("other_deductions", 0))
        
        total_deductions = total_statutory + attendance_ded + other_ded
        gross = record.get("gross_salary", 0)
        net = gross - total_deductions
        
        update_data["total_statutory_deductions"] = round(total_statutory, 2)
        update_data["total_deductions"] = round(total_deductions, 2)
        update_data["net_salary"] = round(net, 2)
        update_data["version"] = record.get("version", 1) + 1
        
        await self.db.payroll_records.update_one(
            {"id": record_id},
            {"$set": update_data}
        )
        
        # Recalculate batch totals
        await self._recalculate_batch_totals(batch_id)
        
        # Get updated record
        updated_record = await self.db.payroll_records.find_one({"id": record_id}, {"_id": 0})
        
        # Log audit
        await self._log_audit(
            "payroll_record", record_id, "update",
            updated_by, {"batch_id": batch_id, "changes": update_data}
        )
        
        return updated_record
    
    async def _recalculate_batch_totals(self, batch_id: str):
        """Recalculate batch totals after record updates"""
        records = await self.db.payroll_records.find(
            {"batch_id": batch_id},
            {"_id": 0}
        ).to_list(10000)
        
        total_gross = sum(r.get("gross_salary", 0) for r in records)
        total_statutory = sum(r.get("total_statutory_deductions", 0) for r in records)
        total_attendance = sum(r.get("attendance_deduction", 0) for r in records)
        total_other = sum(r.get("other_deductions", 0) for r in records)
        total_net = sum(r.get("net_salary", 0) for r in records)
        
        await self.db.payroll_batches.update_one(
            {"id": batch_id},
            {"$set": {
                "employee_count": len(records),
                "total_gross": round(total_gross, 2),
                "total_statutory_deductions": round(total_statutory, 2),
                "total_attendance_deductions": round(total_attendance, 2),
                "total_other_deductions": round(total_other, 2),
                "total_net": round(total_net, 2)
            }}
        )
    
    async def confirm_batch(
        self,
        batch_id: str,
        confirmed_by: str,
        confirmed_by_name: str,
        notes: Optional[str] = None
    ) -> dict:
        """
        Confirm a batch (DRAFT → CONFIRMED).
        Locks all records. Payslips can now be generated.
        """
        batch = await self.db.payroll_batches.find_one({"id": batch_id}, {"_id": 0})
        if not batch:
            raise ValueError("Batch not found")
        if batch.get("status") != "DRAFT":
            raise ValueError(f"Can only confirm DRAFT batches. Current status: {batch.get('status')}")
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Lock all records
        await self.db.payroll_records.update_many(
            {"batch_id": batch_id},
            {"$set": {"is_locked": True}}
        )
        
        # Update batch status
        update_data = {
            "status": "CONFIRMED",
            "confirmed_by": confirmed_by,
            "confirmed_by_name": confirmed_by_name,
            "confirmed_at": now
        }
        if notes:
            update_data["notes"] = notes
        
        await self.db.payroll_batches.update_one(
            {"id": batch_id},
            {"$set": update_data}
        )
        
        # Log audit
        await self._log_audit(
            "payroll_batch", batch_id, "confirm",
            confirmed_by, {"status": "CONFIRMED", "notes": notes}
        )
        
        batch.update(update_data)
        return batch
    
    async def mark_batch_paid(
        self,
        batch_id: str,
        payment_date: str,
        payment_mode: str,
        transaction_reference: str,
        paid_by: str,
        paid_by_name: str,
        notes: Optional[str] = None
    ) -> dict:
        """
        Mark batch as paid (CONFIRMED → CLOSED).
        No further edits allowed after this.
        """
        batch = await self.db.payroll_batches.find_one({"id": batch_id}, {"_id": 0})
        if not batch:
            raise ValueError("Batch not found")
        if batch.get("status") != "CONFIRMED":
            raise ValueError(f"Can only mark CONFIRMED batches as paid. Current status: {batch.get('status')}")
        
        if not transaction_reference:
            raise ValueError("Transaction reference is required")
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Update all records in batch
        await self.db.payroll_records.update_many(
            {"batch_id": batch_id},
            {"$set": {
                "payment_status": "PAID",
                "payment_date": payment_date,
                "payment_mode": payment_mode,
                "transaction_reference": transaction_reference,
                "payment_by": paid_by,
                "payment_by_name": paid_by_name,
                "payment_timestamp": now
            }}
        )
        
        # Update batch status
        update_data = {
            "status": "CLOSED",
            "closed_by": paid_by,
            "closed_by_name": paid_by_name,
            "closed_at": now,
            "payment_date": payment_date,
            "payment_mode": payment_mode,
            "transaction_reference": transaction_reference
        }
        if notes:
            update_data["notes"] = notes
        
        await self.db.payroll_batches.update_one(
            {"id": batch_id},
            {"$set": update_data}
        )
        
        # Log audit
        await self._log_audit(
            "payroll_batch", batch_id, "mark_paid",
            paid_by, {
                "status": "CLOSED",
                "transaction_reference": transaction_reference,
                "payment_mode": payment_mode,
                "total_amount": batch.get("total_net")
            }
        )
        
        batch.update(update_data)
        return batch
    
    async def get_batch(self, batch_id: str) -> Optional[dict]:
        """Get a batch by ID"""
        batch = await self.db.payroll_batches.find_one({"id": batch_id}, {"_id": 0})
        return batch
    
    async def get_batch_records(self, batch_id: str) -> List[dict]:
        """Get all records in a batch"""
        records = await self.db.payroll_records.find(
            {"batch_id": batch_id},
            {"_id": 0}
        ).sort("employee_name", 1).to_list(10000)
        return records
    
    async def get_batches(
        self,
        country_id: Optional[str] = None,
        status: Optional[str] = None,
        year: Optional[int] = None
    ) -> List[dict]:
        """Get batches with optional filters"""
        query = {}
        if country_id:
            query["country_id"] = country_id
        if status:
            query["status"] = status
        if year:
            query["year"] = year
        
        batches = await self.db.payroll_batches.find(
            query, {"_id": 0}
        ).sort([("year", -1), ("month", -1)]).to_list(1000)
        
        return batches
    
    async def delete_draft_batch(
        self,
        batch_id: str,
        deleted_by: str
    ) -> bool:
        """Delete a DRAFT batch (only DRAFT can be deleted)"""
        batch = await self.db.payroll_batches.find_one({"id": batch_id}, {"_id": 0})
        if not batch:
            raise ValueError("Batch not found")
        if batch.get("status") != "DRAFT":
            raise ValueError("Only DRAFT batches can be deleted")
        
        # Delete all records in batch
        await self.db.payroll_records.delete_many({"batch_id": batch_id})
        
        # Delete batch
        await self.db.payroll_batches.delete_one({"id": batch_id})
        
        # Log audit
        await self._log_audit(
            "payroll_batch", batch_id, "delete",
            deleted_by, {"month": batch.get("month"), "year": batch.get("year")}
        )
        
        return True
