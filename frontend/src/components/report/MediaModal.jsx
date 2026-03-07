import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  X, 
  Play, 
  Shield, 
  Calendar, 
  FileText,
  IndianRupee,
  Plus,
  Trash2,
  CircleDot
} from 'lucide-react';
import { formatCurrency } from '@/data/inspectionData';

// Media Modal for photos and videos
export function MediaModal({ isOpen, onClose, media, type }) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!media) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-base">
            {type === 'video' ? 'Inspection Video' : 'Inspection Photo'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative bg-black">
          {type === 'video' ? (
            <div className="aspect-video flex items-center justify-center">
              {!isPlaying ? (
                <div className="text-center">
                  <Button
                    size="lg"
                    className="rounded-full w-16 h-16 bg-white/20 hover:bg-white/30"
                    onClick={() => setIsPlaying(true)}
                  >
                    <Play className="h-8 w-8 text-white fill-white" />
                  </Button>
                  <p className="text-white/80 mt-4 text-sm">Duration: {media.duration}</p>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <p>Video Player Placeholder</p>
                </div>
              )}
            </div>
          ) : (
            <img
              src={media.full || media.thumbnail}
              alt="Inspection"
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          )}
        </div>
        
        <div className="p-4 border-t bg-card">
          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Insurance Details Modal
export function InsuranceModal({ isOpen, onClose, insurance, isEditMode }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            Insurance Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Insurer Name</Label>
              <p className={`font-medium ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-2 py-1' : ''}`}>
                {insurance.insurerName}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Policy Number</Label>
              <p className={`font-medium text-sm ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-2 py-1' : ''}`}>
                {insurance.policyNumber}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Policy Type</Label>
              <p className="font-medium">{insurance.policyType}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Expiry Date</Label>
              <p className={`font-medium ${insurance.status === 'Expired' ? 'text-destructive' : 'text-success'}`}>
                {insurance.expiryDate}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">IDV Value</Label>
              <p className="font-medium">{formatCurrency(insurance.idvValue)}</p>
            </div>
          </div>
          
          <div className={`p-3 rounded-lg ${insurance.status === 'Expired' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
            <p className="font-medium text-center">Status: {insurance.status}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Tyre Details Modal - Enhanced with Q&A photos
export function TyreModal({ isOpen, onClose, tyreDetails, tyreQAData, isEditMode }) {
  // Parse tyre data from Q&A if available
  const parseTyreLifePercentage = (subAnswer) => {
    if (!subAnswer) return 0;
    // Format: "60-80", "20-40", etc. - take the average
    const match = subAnswer.match(/(\d+)-(\d+)/);
    if (match) {
      return Math.round((parseInt(match[1]) + parseInt(match[2])) / 2);
    }
    // Try parsing as single number
    const num = parseInt(subAnswer);
    return isNaN(num) ? 0 : num;
  };

  // Extract tyre questions from Q&A data
  const tyreQuestions = (tyreQAData || []).filter(q => 
    q.question_text && 
    q.question_text.toLowerCase().includes('tyre') && 
    q.question_text.toLowerCase().includes('photo') &&
    !q.question_text.toLowerCase().includes('boot') &&
    !q.question_text.toLowerCase().includes('trunk')
  );

  // Map tyre questions to display format
  const tyresFromQA = tyreQuestions.map(q => {
    // Extract position from question text
    let position = 'Tyre';
    if (q.question_text.toLowerCase().includes('front right')) position = 'Front Right';
    else if (q.question_text.toLowerCase().includes('rear right')) position = 'Rear Right';
    else if (q.question_text.toLowerCase().includes('front left')) position = 'Front Left';
    else if (q.question_text.toLowerCase().includes('rear left')) position = 'Rear Left';
    else if (q.question_text.toLowerCase().includes('spare')) position = 'Spare';
    
    return {
      position,
      photo: q.media_url || q.answer,
      treadLife: parseTyreLifePercentage(q.sub_answer_1),
      condition: q.sub_answer_1 || 'N/A'
    };
  });

  // Use Q&A data if available, otherwise fall back to legacy tyreDetails
  const displayTyres = tyresFromQA.length > 0 ? tyresFromQA : (tyreDetails?.tyres || []);
  
  // Calculate average tyre life
  const avgLife = displayTyres.length > 0 
    ? Math.round(displayTyres.reduce((sum, t) => sum + t.treadLife, 0) / displayTyres.length)
    : (tyreDetails?.avgLife || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDot className="h-5 w-5 text-accent" />
            Tyre Condition Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Average Life */}
          <div className="text-center p-4 bg-secondary/50 rounded-xl">
            <p className="text-sm text-muted-foreground">Average Tyre Life</p>
            <p className={`text-3xl font-bold ${avgLife >= 50 ? 'text-success' : avgLife >= 30 ? 'text-warning' : 'text-destructive'}`}>
              {avgLife}%
            </p>
          </div>
          
          {/* Tyre Grid */}
          {displayTyres.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {displayTyres.map((tyre, index) => (
                <div key={index} className="border border-border rounded-xl overflow-hidden">
                  {/* Tyre Photo */}
                  <div className="aspect-video relative bg-muted">
                    {tyre.photo ? (
                      <img 
                        src={tyre.photo} 
                        alt={tyre.position}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CircleDot className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-xs font-medium">{tyre.position}</p>
                    </div>
                  </div>
                  {/* Tyre Info */}
                  <div className="p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-muted-foreground">Tread Life</span>
                      <span className={`text-sm font-bold ${tyre.treadLife >= 50 ? 'text-success' : tyre.treadLife >= 30 ? 'text-warning' : 'text-destructive'}`}>
                        {tyre.treadLife}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${tyre.treadLife >= 50 ? 'bg-success' : tyre.treadLife >= 30 ? 'bg-warning' : 'bg-destructive'}`}
                        style={{ width: `${tyre.treadLife}%` }}
                      />
                    </div>
                    {tyre.condition && tyre.condition !== 'N/A' && (
                      <p className="text-xs text-muted-foreground mt-2">Condition: {tyre.condition}</p>
                    )}
                    {tyre.brand && (
                      <p className="text-xs text-muted-foreground mt-1">Brand: {tyre.brand}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CircleDot className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tyre inspection data available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Repairs Modal with Edit Capability - Updated for calculated repairs
export function RepairsModal({ isOpen, onClose, repairs = [], totalCost = 0, type, isEditMode, onUpdateRepairs }) {
  // Handle both old format (type field) and new format (pre-filtered)
  const filteredRepairs = repairs.filter(r => {
    const repairType = (r.type || '').toLowerCase();
    return repairType === type || repairType === type.toUpperCase();
  });
  
  // Use pre-filtered repairs if provided (new format) or filter from all repairs (old format)
  const displayRepairs = filteredRepairs.length > 0 ? filteredRepairs : repairs;
  
  const [localRepairs, setLocalRepairs] = useState(displayRepairs);
  const [newRepair, setNewRepair] = useState({ type, serviceType: 'spare_part', description: '', cost: '' });

  // Update local repairs when props change
  React.useEffect(() => {
    const filtered = repairs.filter(r => {
      const repairType = (r.type || '').toLowerCase();
      return repairType === type || repairType === type.toUpperCase();
    });
    setLocalRepairs(filtered.length > 0 ? filtered : repairs);
  }, [repairs, type]);

  const typeLabel = type === 'minor' ? 'Minor' : 'Major';
  
  // Calculate total from items or use provided totalCost
  const calculatedTotal = localRepairs.reduce((sum, r) => sum + (r.estimated_cost || r.cost || 0), 0);
  const total = totalCost > 0 ? totalCost : calculatedTotal;

  const handleAddRepair = () => {
    if (newRepair.description && newRepair.cost) {
      const repair = {
        id: Date.now(),
        ...newRepair,
        cost: parseInt(newRepair.cost),
        estimated_cost: parseInt(newRepair.cost)
      };
      setLocalRepairs([...localRepairs, repair]);
      setNewRepair({ type, serviceType: 'spare_part', description: '', cost: '' });
    }
  };

  const handleRemoveRepair = (id) => {
    setLocalRepairs(localRepairs.filter(r => r.id !== id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-accent" />
            {typeLabel} Repairs Estimate
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Repairs List */}
          {localRepairs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <IndianRupee className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No {typeLabel.toLowerCase()} repairs identified</p>
              <p className="text-xs mt-1">Based on inspection Q&A analysis</p>
            </div>
          ) : (
            <div className="space-y-2">
              {localRepairs.map((repair, index) => (
                <div key={repair.id || index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{repair.part_name || repair.description || 'Repair Item'}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {repair.category && <span className="bg-muted px-2 py-0.5 rounded">{repair.category}</span>}
                      {repair.action && <span>• {repair.action}</span>}
                      {repair.priority && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          repair.priority === 'high' || repair.priority === 'critical' 
                            ? 'bg-destructive/10 text-destructive' 
                            : 'bg-warning/10 text-warning'
                        }`}>
                          {repair.priority}
                        </span>
                      )}
                    </div>
                    {repair.parts_cost > 0 && repair.labor_cost > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Parts: {formatCurrency(repair.parts_cost)} + Labor: {formatCurrency(repair.labor_cost)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(repair.estimated_cost || repair.cost || 0)}</span>
                    {isEditMode && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveRepair(repair.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Add New Repair (Edit Mode Only) */}
          {isEditMode && (
            <div className="border border-dashed border-yellow-500 rounded-lg p-4 space-y-3 bg-yellow-50/50">
              <p className="text-sm font-medium">Add New Repair</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Service Type</Label>
                  <Select 
                    value={newRepair.serviceType} 
                    onValueChange={(v) => setNewRepair({...newRepair, serviceType: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spare_part">Spare Part</SelectItem>
                      <SelectItem value="labor">Labor Charge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Input 
                    placeholder="e.g., Brake Pads Replacement"
                    value={newRepair.description}
                    onChange={(e) => setNewRepair({...newRepair, description: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Cost (₹)</Label>
                  <Input 
                    type="number"
                    placeholder="5000"
                    value={newRepair.cost}
                    onChange={(e) => setNewRepair({...newRepair, cost: e.target.value})}
                  />
                </div>
              </div>
              <Button onClick={handleAddRepair} className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-2" /> Add Repair
              </Button>
            </div>
          )}
          
          {/* Total */}
          <div className="flex justify-between items-center p-4 bg-primary/5 rounded-xl border border-primary/20">
            <span className="font-semibold">Total {typeLabel} Repairs</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MediaModal;
