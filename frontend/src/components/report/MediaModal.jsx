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

// Tyre Details Modal
export function TyreModal({ isOpen, onClose, tyreDetails, isEditMode }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
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
            <p className="text-3xl font-bold text-accent">{tyreDetails.avgLife}%</p>
          </div>
          
          {/* Tyre Grid */}
          <div className="grid grid-cols-2 gap-3">
            {tyreDetails.tyres.map((tyre, index) => (
              <div key={index} className="border border-border rounded-xl overflow-hidden">
                <div className="aspect-video relative">
                  <img 
                    src={tyre.photo} 
                    alt={tyre.position}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-white text-xs font-medium">{tyre.position}</p>
                  </div>
                </div>
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
                  <p className="text-xs text-muted-foreground mt-2">Brand: {tyre.brand}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Repairs Modal with Edit Capability
export function RepairsModal({ isOpen, onClose, repairs, type, isEditMode, onUpdateRepairs }) {
  const [localRepairs, setLocalRepairs] = useState(repairs.filter(r => r.type === type));
  const [newRepair, setNewRepair] = useState({ type, serviceType: 'spare_part', description: '', cost: '' });

  const typeLabel = type === 'minor' ? 'Minor' : 'Major';
  const total = localRepairs.reduce((sum, r) => sum + r.cost, 0);

  const handleAddRepair = () => {
    if (newRepair.description && newRepair.cost) {
      const repair = {
        id: Date.now(),
        ...newRepair,
        cost: parseInt(newRepair.cost)
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
          <div className="space-y-2">
            {localRepairs.map((repair) => (
              <div key={repair.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{repair.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {repair.serviceType === 'spare_part' ? '🔧 Spare Part' : '👷 Labor'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCurrency(repair.cost)}</span>
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
                      <SelectItem value="spare_part">🔧 Spare Part</SelectItem>
                      <SelectItem value="labor">👷 Labor Charge</SelectItem>
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
