/**
 * Simple Setup Wizard - Phase 1 Implementation
 *
 * A working setup wizard that demonstrates the infrastructure
 */

import React, { useState } from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Box,
  Button,
  ButtonGroup,
  ProgressBar,
  Badge,
  TextField,
  Select,
  Banner,
  FormLayout,
  Frame,
} from '@shopify/polaris';

interface WizardState {
  step: number;
  programName: string;
  currency: string;
  programType: string;
}

const CURRENCY_OPTIONS = [
  { label: 'Points', value: 'points' },
  { label: 'Coins', value: 'coins' },
  { label: 'Stars', value: 'stars' },
  { label: 'Credits', value: 'credits' },
];

const PROGRAM_TYPE_OPTIONS = [
  { label: 'Points-based', value: 'points-based' },
  { label: 'Tier-based', value: 'tier-based' },
  { label: 'Cashback', value: 'cashback' },
];

const TOTAL_STEPS = 8;

export function SimpleSetupWizard() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    programName: '',
    currency: 'points',
    programType: 'points-based',
  });

  const [errors, setErrors] = useState<string[]>([]);

  const nextStep = () => {
    // Validate current step
    const newErrors: string[] = [];

    if (state.step === 1) {
      if (!state.programName.trim()) {
        newErrors.push('Program name is required');
      }
      if (state.programName.length > 50) {
        newErrors.push('Program name must be 50 characters or less');
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, TOTAL_STEPS) }));
  };

  const prevStep = () => {
    setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 1) }));
  };

  const updateField = (field: keyof WizardState, value: string) => {
    setState(prev => ({ ...prev, [field]: value }));
    setErrors([]); // Clear errors when user starts typing
  };

  const progress = (state.step / TOTAL_STEPS) * 100;
  const isFirstStep = state.step === 1;
  const isLastStep = state.step === TOTAL_STEPS;

  const renderStepContent = () => {
    switch (state.step) {
      case 1:
        return (
          <Box>
            <Banner title="Let's set up your loyalty program!" tone="info">
              <p>We'll help you create a loyalty program that engages customers and drives repeat purchases.</p>
            </Banner>

            <Box paddingBlockStart="500">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Program Information
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <TextField
                        label="Program Name"
                        value={state.programName}
                        onChange={(value) => updateField('programName', value)}
                        placeholder="e.g., My Store Rewards, VIP Club"
                        helpText="Choose a memorable name that reflects your brand"
                        maxLength={50}
                        showCharacterCount
                        autoComplete="off"
                      />
                      <FormLayout.Group condensed>
                        <Select
                          label="Points Currency"
                          options={CURRENCY_OPTIONS}
                          value={state.currency}
                          onChange={(value) => updateField('currency', value)}
                        />
                        <Select
                          label="Program Type"
                          options={PROGRAM_TYPE_OPTIONS}
                          value={state.programType}
                          onChange={(value) => updateField('programType', value)}
                        />
                      </FormLayout.Group>
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>

            {state.programName && (
              <Box paddingBlockStart="400">
                <Card>
                  <Box padding="400">
                    <Text variant="headingMd" as="h4">
                      Preview
                    </Text>
                    <Box paddingBlockStart="300">
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Text variant="bodyLg" fontWeight="semibold" as="p">
                          Welcome to {state.programName}!
                        </Text>
                        <Text variant="bodyMd" tone="subdued" as="p">
                          Start earning {state.currency} with every purchase.
                        </Text>
                      </Box>
                    </Box>
                  </Box>
                </Card>
              </Box>
            )}
          </Box>
        );

      default:
        return (
          <Card>
            <Box padding="600" style={{ textAlign: 'center' }}>
              <Text variant="headingLg" as="h2">
                Step {state.step} - Coming Soon
              </Text>
              <Box paddingBlockStart="300">
                <Text variant="bodyMd" tone="subdued" as="p">
                  This step will be implemented in the next phase.
                  <br />
                  For now, you can see the navigation flow working.
                </Text>
              </Box>
              <Box paddingBlockStart="400" style={{
                padding: '40px',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px dashed #d1d5db'
              }}>
                <Text variant="bodyMd" as="p">
                  🚧 Phase 2 will implement: Points Configuration, Rewards, Design, Theme Integration, Email Setup, Testing, and Launch
                </Text>
              </Box>
            </Box>
          </Card>
        );
    }
  };

  return (
    <Frame>
      <Page
        title="Loyco Rewards Setup"
        subtitle="Configuration Wizard"
      >
        <Layout>
          {/* Progress Section */}
          <Layout.Section>
            <Card>
              <Box padding="400">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <Text variant="headingMd" as="h2">
                    Program Setup
                  </Text>
                  <Badge tone="info">
                    {Math.round(progress)}% Complete
                  </Badge>
                </div>
                <ProgressBar progress={progress} size="large" />
                <Box paddingBlockStart="200">
                  <Text variant="bodySm" tone="subdued" as="p">
                    Step {state.step} of {TOTAL_STEPS} • About {Math.max(0, (TOTAL_STEPS - state.step) * 2)} minutes remaining
                  </Text>
                </Box>
              </Box>
            </Card>
          </Layout.Section>

          {/* Main Content */}
          <Layout.Section>
            <Box>
              {/* Error Display */}
              {errors.length > 0 && (
                <Box paddingBlockEnd="400">
                  <Banner title="Please fix the following errors:" tone="critical">
                    <ul>
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </Banner>
                </Box>
              )}

              {/* Step Content */}
              {renderStepContent()}
            </Box>
          </Layout.Section>

          {/* Navigation */}
          <Layout.Section>
            <Card>
              <Box padding="400">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    {!isFirstStep && (
                      <Button onClick={prevStep}>
                        Back
                      </Button>
                    )}
                  </Box>
                  <Box>
                    <ButtonGroup>
                      <Button
                        variant="primary"
                        onClick={nextStep}
                        disabled={errors.length > 0}
                      >
                        {isLastStep ? '🚀 Launch Program' : 'Continue'}
                      </Button>
                    </ButtonGroup>
                  </Box>
                </div>
                <Box paddingBlockStart="300" style={{ textAlign: 'center' }}>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Step {state.step} of {TOTAL_STEPS}
                  </Text>
                </Box>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}