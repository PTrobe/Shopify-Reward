/**
 * Setup Flow Data Models and Types
 *
 * Comprehensive type definitions for the loyalty program setup wizard
 */

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
  isAccessible: boolean;
}

export interface ProgramBasics {
  programName: string;
  currency: 'points' | 'coins' | 'stars' | 'credits';
  programType: 'points-based' | 'tier-based' | 'cashback';
  isActive: boolean;
}

export interface PointsConfiguration {
  purchaseRate: number; // points per dollar
  purchaseCurrency: string; // USD, EUR, etc.
  welcomeBonus: number;
  birthdayBonus: number;
  socialFollowBonus: number;
  reviewBonus: number;
  referralBonus: number;
}

export interface RewardTier {
  id: string;
  name: string;
  minPoints: number;
  color: string;
  benefits: RewardBenefit[];
}

export interface RewardBenefit {
  id: string;
  type: 'discount' | 'free-shipping' | 'free-product' | 'exclusive-access';
  title: string;
  description: string;
  pointsCost: number;
  discountValue?: number;
  discountType?: 'percentage' | 'fixed';
  productId?: string;
  isActive: boolean;
}

export interface VisualCustomization {
  primaryColor: string;
  starColor: string;
  textColor: string;
  backgroundColor: string;
  widgetStyle: 'compact' | 'balanced' | 'full-width';
  fontFamily: string;
  borderRadius: number;
}

export interface ThemeIntegration {
  themeId: string;
  themeName: string;
  placements: {
    header: boolean;
    cart: boolean;
    product: boolean;
    account: boolean;
    footer: boolean;
  };
  customPlacements: ThemePlacement[];
}

export interface ThemePlacement {
  id: string;
  location: string;
  blockType: string;
  settings: Record<string, any>;
}

export interface EmailConfiguration {
  fromEmail: string;
  replyToEmail: string;
  templates: {
    welcome: EmailTemplate;
    pointsEarned: EmailTemplate;
    rewardAvailable: EmailTemplate;
    birthdayBonus: EmailTemplate;
  };
}

export interface EmailTemplate {
  subject: string;
  isEnabled: boolean;
  customContent?: string;
}

export interface SetupFormData {
  step: number;
  programBasics: ProgramBasics;
  pointsConfiguration: PointsConfiguration;
  rewardTiers: RewardTier[];
  visualCustomization: VisualCustomization;
  themeIntegration: ThemeIntegration;
  emailConfiguration: EmailConfiguration;
  isCompleted: boolean;
  completedAt?: string;
}

export interface SetupValidationError {
  field: string;
  message: string;
  step: number;
}

export interface SetupProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  percentComplete: number;
  estimatedTimeRemaining: number; // in minutes
}

export interface SetupContext {
  data: SetupFormData;
  progress: SetupProgress;
  errors: SetupValidationError[];
  isLoading: boolean;
  isSaving: boolean;
  updateData: (updates: Partial<SetupFormData>) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  saveProgress: () => Promise<void>;
  validateStep: (step: number) => SetupValidationError[];
  reset: () => void;
}

// Default values for initialization
export const DEFAULT_PROGRAM_BASICS: ProgramBasics = {
  programName: '',
  currency: 'points',
  programType: 'points-based',
  isActive: false,
};

export const DEFAULT_POINTS_CONFIG: PointsConfiguration = {
  purchaseRate: 1,
  purchaseCurrency: 'USD',
  welcomeBonus: 100,
  birthdayBonus: 50,
  socialFollowBonus: 25,
  reviewBonus: 15,
  referralBonus: 100,
};

export const DEFAULT_VISUAL_CUSTOMIZATION: VisualCustomization = {
  primaryColor: '#2563eb',
  starColor: '#fbbf24',
  textColor: '#1f2937',
  backgroundColor: '#f9fafb',
  widgetStyle: 'balanced',
  fontFamily: 'inherit',
  borderRadius: 8,
};

export const SETUP_STEPS: SetupStep[] = [
  {
    id: 'basics',
    title: 'Program Basics',
    description: 'Set up your loyalty program name and type',
    isCompleted: false,
    isActive: true,
    isAccessible: true,
  },
  {
    id: 'points',
    title: 'Points Configuration',
    description: 'Configure how customers earn points',
    isCompleted: false,
    isActive: false,
    isAccessible: false,
  },
  {
    id: 'rewards',
    title: 'Reward Tiers',
    description: 'Set up rewards and redemption options',
    isCompleted: false,
    isActive: false,
    isAccessible: false,
  },
  {
    id: 'design',
    title: 'Visual Customization',
    description: 'Match your brand colors and style',
    isCompleted: false,
    isActive: false,
    isAccessible: false,
  },
  {
    id: 'integration',
    title: 'Theme Integration',
    description: 'Choose where loyalty features appear',
    isCompleted: false,
    isActive: false,
    isAccessible: false,
  },
  {
    id: 'emails',
    title: 'Email Notifications',
    description: 'Configure customer communications',
    isCompleted: false,
    isActive: false,
    isAccessible: false,
  },
  {
    id: 'testing',
    title: 'Test & Preview',
    description: 'Test your setup before going live',
    isCompleted: false,
    isActive: false,
    isAccessible: false,
  },
  {
    id: 'launch',
    title: 'Launch & Success',
    description: 'Activate your loyalty program',
    isCompleted: false,
    isActive: false,
    isAccessible: false,
  },
];