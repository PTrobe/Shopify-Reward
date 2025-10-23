/**
 * Setup Context - State Management for Setup Wizard
 *
 * Provides comprehensive state management for the loyalty program setup flow
 * with persistence, validation, and progress tracking.
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  SetupContext as ISetupContext,
  SetupFormData,
  SetupProgress,
  SetupValidationError,
  DEFAULT_PROGRAM_BASICS,
  DEFAULT_POINTS_CONFIG,
  DEFAULT_VISUAL_CUSTOMIZATION,
  SETUP_STEPS,
} from '../types/setup';

// Setup state interface
interface SetupState {
  data: SetupFormData;
  progress: SetupProgress;
  errors: SetupValidationError[];
  isLoading: boolean;
  isSaving: boolean;
}

// Action types for reducer
type SetupAction =
  | { type: 'UPDATE_DATA'; payload: Partial<SetupFormData> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERRORS'; payload: SetupValidationError[] }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREVIOUS_STEP' }
  | { type: 'GO_TO_STEP'; payload: number }
  | { type: 'RESET' }
  | { type: 'LOAD_SAVED_DATA'; payload: SetupFormData };

// Initial state
const initialData: SetupFormData = {
  step: 1,
  programBasics: DEFAULT_PROGRAM_BASICS,
  pointsConfiguration: DEFAULT_POINTS_CONFIG,
  rewardTiers: [],
  visualCustomization: DEFAULT_VISUAL_CUSTOMIZATION,
  themeIntegration: {
    themeId: '',
    themeName: '',
    placements: {
      header: true,
      cart: true,
      product: true,
      account: true,
      footer: false,
    },
    customPlacements: [],
  },
  emailConfiguration: {
    fromEmail: '',
    replyToEmail: '',
    templates: {
      welcome: { subject: 'Welcome to our loyalty program!', isEnabled: true },
      pointsEarned: { subject: 'You earned points!', isEnabled: true },
      rewardAvailable: { subject: 'Your reward is ready!', isEnabled: true },
      birthdayBonus: { subject: 'Happy birthday - here\'s a gift!', isEnabled: true },
    },
  },
  isCompleted: false,
};

const initialProgress: SetupProgress = {
  currentStep: 1,
  totalSteps: SETUP_STEPS.length,
  completedSteps: [],
  percentComplete: 0,
  estimatedTimeRemaining: 15,
};

const initialState: SetupState = {
  data: initialData,
  progress: initialProgress,
  errors: [],
  isLoading: false,
  isSaving: false,
};

// Reducer function
function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'UPDATE_DATA':
      return {
        ...state,
        data: { ...state.data, ...action.payload },
        errors: state.errors.filter(error =>
          !Object.keys(action.payload).some(key => key.includes(error.field))
        ),
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'SET_ERRORS':
      return { ...state, errors: action.payload };

    case 'CLEAR_ERRORS':
      return { ...state, errors: [] };

    case 'NEXT_STEP':
      const nextStep = Math.min(state.progress.currentStep + 1, state.progress.totalSteps);
      const updatedCompletedSteps = [...state.progress.completedSteps];
      if (!updatedCompletedSteps.includes(state.progress.currentStep)) {
        updatedCompletedSteps.push(state.progress.currentStep);
      }

      return {
        ...state,
        data: { ...state.data, step: nextStep },
        progress: {
          ...state.progress,
          currentStep: nextStep,
          completedSteps: updatedCompletedSteps,
          percentComplete: (updatedCompletedSteps.length / state.progress.totalSteps) * 100,
          estimatedTimeRemaining: Math.max(0, (state.progress.totalSteps - nextStep) * 2),
        },
      };

    case 'PREVIOUS_STEP':
      const prevStep = Math.max(1, state.progress.currentStep - 1);
      return {
        ...state,
        data: { ...state.data, step: prevStep },
        progress: {
          ...state.progress,
          currentStep: prevStep,
        },
      };

    case 'GO_TO_STEP':
      const targetStep = Math.max(1, Math.min(action.payload, state.progress.totalSteps));
      return {
        ...state,
        data: { ...state.data, step: targetStep },
        progress: {
          ...state.progress,
          currentStep: targetStep,
        },
      };

    case 'LOAD_SAVED_DATA':
      const loadedData = action.payload;
      return {
        ...state,
        data: loadedData,
        progress: {
          ...state.progress,
          currentStep: loadedData.step,
          completedSteps: Array.from({ length: loadedData.step - 1 }, (_, i) => i + 1),
          percentComplete: ((loadedData.step - 1) / state.progress.totalSteps) * 100,
        },
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// Context creation
const SetupContext = createContext<ISetupContext | undefined>(undefined);

// Custom hook to use setup context
export function useSetup(): ISetupContext {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error('useSetup must be used within a SetupProvider');
  }
  return context;
}

// Validation functions
function validateStep(step: number, data: SetupFormData): SetupValidationError[] {
  const errors: SetupValidationError[] = [];

  switch (step) {
    case 1: // Program Basics
      if (!data.programBasics.programName.trim()) {
        errors.push({
          field: 'programBasics.programName',
          message: 'Program name is required',
          step: 1,
        });
      }
      if (data.programBasics.programName.length > 50) {
        errors.push({
          field: 'programBasics.programName',
          message: 'Program name must be 50 characters or less',
          step: 1,
        });
      }
      break;

    case 2: // Points Configuration
      if (data.pointsConfiguration.purchaseRate <= 0) {
        errors.push({
          field: 'pointsConfiguration.purchaseRate',
          message: 'Purchase rate must be greater than 0',
          step: 2,
        });
      }
      if (data.pointsConfiguration.welcomeBonus < 0) {
        errors.push({
          field: 'pointsConfiguration.welcomeBonus',
          message: 'Welcome bonus cannot be negative',
          step: 2,
        });
      }
      break;

    case 3: // Reward Tiers
      if (data.rewardTiers.length === 0) {
        errors.push({
          field: 'rewardTiers',
          message: 'At least one reward tier is required',
          step: 3,
        });
      }
      break;

    case 6: // Email Configuration
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (data.emailConfiguration.fromEmail && !emailRegex.test(data.emailConfiguration.fromEmail)) {
        errors.push({
          field: 'emailConfiguration.fromEmail',
          message: 'Please enter a valid email address',
          step: 6,
        });
      }
      break;
  }

  return errors;
}

// Storage keys
const STORAGE_KEY = 'loyco-setup-progress';
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

// Provider component
interface SetupProviderProps {
  children: ReactNode;
}

export function SetupProvider({ children }: SetupProviderProps) {
  const [state, dispatch] = useReducer(setupReducer, initialState);

  // Load saved data on mount
  useEffect(() => {
    const loadSavedData = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsedData = JSON.parse(saved);
          dispatch({ type: 'LOAD_SAVED_DATA', payload: parsedData });
        }
      } catch (error) {
        console.warn('Failed to load saved setup data:', error);
      }
    };

    loadSavedData();
  }, []);

  // Auto-save functionality
  useEffect(() => {
    const autoSave = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      } catch (error) {
        console.warn('Failed to auto-save setup data:', error);
      }
    };

    const interval = setInterval(autoSave, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [state.data]);

  // Context value implementation
  const contextValue: ISetupContext = {
    data: state.data,
    progress: state.progress,
    errors: state.errors,
    isLoading: state.isLoading,
    isSaving: state.isSaving,

    updateData: (updates: Partial<SetupFormData>) => {
      dispatch({ type: 'UPDATE_DATA', payload: updates });
    },

    nextStep: () => {
      const errors = validateStep(state.progress.currentStep, state.data);
      if (errors.length > 0) {
        dispatch({ type: 'SET_ERRORS', payload: errors });
        return;
      }
      dispatch({ type: 'CLEAR_ERRORS' });
      dispatch({ type: 'NEXT_STEP' });
    },

    previousStep: () => {
      dispatch({ type: 'PREVIOUS_STEP' });
    },

    goToStep: (step: number) => {
      dispatch({ type: 'GO_TO_STEP', payload: step });
    },

    saveProgress: async () => {
      dispatch({ type: 'SET_SAVING', payload: true });
      try {
        // TODO: Implement API call to save progress to database
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      } catch (error) {
        console.error('Failed to save progress:', error);
        throw error;
      } finally {
        dispatch({ type: 'SET_SAVING', payload: false });
      }
    },

    validateStep: (step: number) => {
      return validateStep(step, state.data);
    },

    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      dispatch({ type: 'RESET' });
    },
  };

  return (
    <SetupContext.Provider value={contextValue}>
      {children}
    </SetupContext.Provider>
  );
}