import React, { useState } from 'react';
import { useEditMode } from '@/context/EditModeContext';
import { Badge } from '@/components/ui/badge';
import { MediaModal } from './MediaModal';
import { 
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Settings,
  Cog,
  Snowflake,
  Battery,
  CircleDot,
  Car,
  Armchair,
  Radio,
  Lightbulb,
  CircleDashed,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Image,
  Video,
  MessageSquare,
  HelpCircle
} from 'lucide-react';

const iconMap = {
  Settings: Settings,
  Cog: Cog,
  Snowflake: Snowflake,
  Battery: Battery,
  CircleDot: CircleDot,
  Car: Car,
  Armchair: Armchair,
  Radio: Radio,
  Lightbulb: Lightbulb,
  CircleDashed: CircleDashed
};

const StatusIcon = ({ status }) => {
  const s = status ? status.toLowerCase() : '';
  if (s === 'good') return <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />;
  if (s === 'average') return <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />;
  if (s === 'poor') return <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />;
  return null;
};

// Enhanced Checkpoint Card with Q&A, Photo, Video support
const CheckpointCard = ({ detail, isEditMode, onMediaClick }) => {
  const getStatusBg = () => {
    const s = detail.status ? detail.status.toLowerCase() : '';
    if (s === 'good') return 'border-success/30 bg-success/5';
    if (s === 'average') return 'border-warning/30 bg-warning/5';
    if (s === 'poor') return 'border-destructive/30 bg-destructive/5';
    return 'border-border bg-card';
  };

  const getTypeIcon = () => {
    if (detail.type === 'photo') return <Image className="h-3 w-3" />;
    if (detail.type === 'video') return <Video className="h-3 w-3" />;
    return <MessageSquare className="h-3 w-3" />;
  };

  const getTypeLabel = () => {
    if (detail.type === 'photo') return 'Photo';
    if (detail.type === 'video') return detail.media?.duration || 'Video';
    return 'Q&A';
  };

  return (
    <div className={`flex-shrink-0 w-[220px] md:w-[260px] rounded-xl border ${getStatusBg()} overflow-hidden`}>
      {/* Media Preview (Photo or Video) */}
      {(detail.type === 'photo' || detail.type === 'video') && detail.media && (
        <button 
          className="w-full aspect-video relative bg-muted"
          onClick={() => onMediaClick(detail.media, detail.type)}
        >
          <img 
            src={detail.media.thumbnail} 
            alt={detail.item}
            className="w-full h-full object-cover"
          />
          {detail.type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm">
                <Video className="h-5 w-5 text-white" />
              </div>
              <span className="absolute bottom-2 right-2 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded">
                {detail.media.duration}
              </span>
            </div>
          )}
        </button>
      )}
      
      {/* Card Content */}
      <div className="p-3 space-y-2">
        {/* Header: Item Name & Status */}
        <div className="flex items-start gap-2">
          <StatusIcon status={detail.status} />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium leading-tight ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
              {detail.item}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {getTypeIcon()}
                {getTypeLabel()}
              </span>
              <span className="text-xs text-muted-foreground">{detail.note}</span>
            </div>
          </div>
        </div>
        
        {/* Question & Answer Section */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          {/* For Q&A type - Show main question */}
          {detail.type === 'qa' && (
            <>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" /> Question
                </p>
                <p className={`text-xs mt-0.5 ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                  {detail.question}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Answer</p>
                <p className={`text-xs font-medium mt-0.5 ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                  {detail.answer}
                </p>
              </div>
            </>
          )}
          
          {/* For Photo/Video - Show capture instruction */}
          {(detail.type === 'photo' || detail.type === 'video') && detail.captureInstruction && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <HelpCircle className="h-3 w-3" /> Instruction
              </p>
              <p className={`text-xs mt-0.5 ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                {detail.captureInstruction}
              </p>
            </div>
          )}
          
          {/* For Photo/Video with follow-up Q&A */}
          {(detail.type === 'photo' || detail.type === 'video') && detail.followUpQuestion && (
            <>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Follow-up
                </p>
                <p className={`text-xs mt-0.5 ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                  {detail.followUpQuestion}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Answer</p>
                <p className={`text-xs font-medium mt-0.5 ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                  {detail.followUpAnswer}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Category Section with horizontal scroll
const CategorySection = ({ category, isEditMode, onMediaClick }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = iconMap[category.icon] || Settings;
  
  const getRatingColor = () => {
    if (category.rating >= 8) return 'text-success';
    if (category.rating >= 6) return 'text-warning';
    return 'text-destructive';
  };

  const getProgressColor = () => {
    if (category.rating >= 8) return 'bg-success';
    if (category.rating >= 6) return 'bg-warning';
    return 'bg-destructive';
  };

  const goodCount = category.details.filter(d => d.status?.toLowerCase() === 'good').length;
  const issuesCount = category.details.filter(d => d.status?.toLowerCase() === 'poor').length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Category Header */}
      <button 
        className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 flex-shrink-0">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-sm md:text-base">{category.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{category.checkpoints} pts</span>
              <span className="text-success text-xs flex items-center gap-0.5">
                <CheckCircle2 className="h-3 w-3" /> {goodCount}
              </span>
              {issuesCount > 0 && (
                <span className="text-destructive text-xs flex items-center gap-0.5">
                  <XCircle className="h-3 w-3" /> {issuesCount}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={`text-xl md:text-2xl font-bold font-display ${getRatingColor()}`}>
              {category.rating}
            </span>
            <span className="text-xs text-muted-foreground">/10</span>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${getProgressColor()}`}
            style={{ width: `${category.rating * 10}%` }}
          />
        </div>
      </div>
      
      {/* Horizontal Scrolling Checkpoints */}
      {isExpanded && (
        <div className="border-t border-border">
          <div className="p-4 overflow-x-auto hide-scrollbar">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {category.details.map((detail, idx) => (
                <CheckpointCard 
                  key={idx} 
                  detail={detail} 
                  isEditMode={isEditMode}
                  onMediaClick={onMediaClick}
                />
              ))}
            </div>
          </div>
          {/* Scroll hint for mobile */}
          <div className="md:hidden px-4 pb-3 -mt-2">
            <p className="text-[10px] text-muted-foreground text-center">
              ← Swipe to see more checkpoints →
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export function InspectionDetailsSection({ data }) {
  const { isEditMode } = useEditMode();
  const [mediaModal, setMediaModal] = useState({ isOpen: false, media: null, type: null });
  
  const totalCheckpoints = data.reduce((sum, cat) => sum + cat.checkpoints, 0);

  const handleMediaClick = (media, type) => {
    setMediaModal({ isOpen: true, media, type });
  };

  return (
    <section className="px-4 md:px-0 mt-4 md:mt-6">
      {/* Section Header */}
      <div className="mobile-card md:rounded-2xl mb-4">
        <div className="mobile-card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <ClipboardList className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <h2 className="font-semibold font-display text-base md:text-lg">Inspection Details</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-lg md:text-xl font-bold font-display">{totalCheckpoints}+</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">Checkpoints</p>
            </div>
            <div className="text-center">
              <p className="text-lg md:text-xl font-bold font-display">{data.length}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">Categories</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Categories - Desktop: Grid, Mobile: Stack */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.map((category) => (
          <CategorySection 
            key={category.id} 
            category={category} 
            isEditMode={isEditMode}
            onMediaClick={handleMediaClick}
          />
        ))}
      </div>
      
      {/* Media Modal */}
      <MediaModal 
        isOpen={mediaModal.isOpen}
        onClose={() => setMediaModal({ isOpen: false, media: null, type: null })}
        media={mediaModal.media}
        type={mediaModal.type}
      />
    </section>
  );
}

export default InspectionDetailsSection;
