/**
 * Setup Wizard Component
 *
 * Main orchestrator for the setup flow - renders the appropriate step component
 */

import React from 'react';
import { useSetup } from '../../contexts/SetupContext';
import { SetupLayout } from './SetupLayout';
import { ProgramBasicsStep } from './steps/ProgramBasicsStep';
import { SETUP_STEPS } from '../../types/setup';

// Placeholder components for future steps
function ComingSoonStep({ stepName }: { stepName: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      background: '#f9fafb',
      borderRadius: '8px',
      border: '1px dashed #d1d5db'
    }}>
      <h3 style={{ marginBottom: '16px', color: '#6b7280' }}>
        {stepName} - Coming Soon
      </h3>
      <p style={{ color: '#9ca3af', fontSize: '14px' }}>
        This step will be implemented in the next phase.
        <br />
        For now, you can continue to see the navigation flow.
      </p>
    </div>
  );
}

export function SetupWizard() {
  const { progress } = useSetup();

  // Get current step information
  const currentStepData = SETUP_STEPS[progress.currentStep - 1];

  if (!currentStepData) {
    return (
      <SetupLayout
        title="Setup Complete"
        description="Your loyalty program has been configured successfully!"
      >
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>🎉 Congratulations!</h2>
          <p>Your loyalty program is ready to launch.</p>
        </div>
      </SetupLayout>
    );
  }

  // Render the appropriate step component
  const renderStepContent = () => {
    switch (progress.currentStep) {
      case 1:
        return <ProgramBasicsStep />;
      case 2:
        return <ComingSoonStep stepName="Points Configuration" />;
      case 3:
        return <ComingSoonStep stepName="Reward Tiers" />;
      case 4:
        return <ComingSoonStep stepName="Visual Customization" />;
      case 5:
        return <ComingSoonStep stepName="Theme Integration" />;
      case 6:
        return <ComingSoonStep stepName="Email Notifications" />;
      case 7:
        return <ComingSoonStep stepName="Test & Preview" />;
      case 8:
        return <ComingSoonStep stepName="Launch & Success" />;
      default:
        return <ComingSoonStep stepName="Unknown Step" />;
    }
  };

  return (
    <SetupLayout
      title={currentStepData.title}
      description={currentStepData.description}
    >
      {renderStepContent()}
    </SetupLayout>
  );
}