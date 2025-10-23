/**
 * Progress Indicator Component
 *
 * Beautiful visual progress indicator for the setup wizard with step navigation
 */

import React from 'react';
import { Box, Text, ProgressBar, Badge } from '@shopify/polaris';
import { useSetup } from '../../contexts/SetupContext';
import { SETUP_STEPS } from '../../types/setup';

interface ProgressIndicatorProps {
  showStepNames?: boolean;
  allowStepNavigation?: boolean;
  compact?: boolean;
}

export function ProgressIndicator({
  showStepNames = true,
  allowStepNavigation = false,
  compact = false,
}: ProgressIndicatorProps) {
  const { progress } = useSetup();

  if (compact) {
    return (
      <Box padding="400">
        <Box paddingBlockEnd="200">
          <Text variant="headingXs" as="h3">
            Step {progress.currentStep} of {progress.totalSteps}
          </Text>
          <Text variant="bodySm" tone="subdued" as="p">
            {SETUP_STEPS[progress.currentStep - 1]?.title}
          </Text>
        </Box>
        <Box paddingBlockEnd="200">
          <ProgressBar progress={progress.percentComplete} size="small" />
        </Box>
        <Text variant="bodySm" tone="subdued" as="p">
          {Math.round(progress.percentComplete)}% complete
          {progress.estimatedTimeRemaining > 0 && (
            <> • {progress.estimatedTimeRemaining} min remaining</>
          )}
        </Text>
      </Box>
    );
  }

  return (
    <Box padding="600" background="bg-surface-secondary">
      {/* Header */}
      <Box paddingBlockEnd="400">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Text variant="headingMd" as="h2">
              Program Setup
            </Text>
            <Text variant="bodyMd" tone="subdued" as="p">
              Step {progress.currentStep} of {progress.totalSteps}
            </Text>
          </Box>
          <Badge tone="info">
            {Math.round(progress.percentComplete)}% Complete
          </Badge>
        </div>
      </Box>

      {/* Progress Bar */}
      <Box paddingBlockEnd="400">
        <ProgressBar
          progress={progress.percentComplete}
          size="large"
        />
        {progress.estimatedTimeRemaining > 0 && (
          <Box paddingBlockStart="200">
            <Text variant="bodySm" tone="subdued" as="p">
              Estimated time remaining: {progress.estimatedTimeRemaining} minutes
            </Text>
          </Box>
        )}
      </Box>

      {/* Step Names */}
      {showStepNames && (
        <Box paddingBlockEnd="400">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SETUP_STEPS.map((step, index) => {
              const stepNumber = index + 1;
              const isCompleted = progress.completedSteps.includes(stepNumber);
              const isCurrent = progress.currentStep === stepNumber;

              return (
                <Box
                  key={step.id}
                  padding="200"
                  background={isCurrent ? 'bg-fill-brand' : isCompleted ? 'bg-fill-success-secondary' : 'bg-surface'}
                  borderRadius="200"
                  borderColor={isCurrent ? 'border-brand' : isCompleted ? 'border-success' : 'border'}
                  borderWidth="025"
                  style={{ minWidth: '120px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Box
                      padding="100"
                      background={isCurrent ? 'bg-surface' : isCompleted ? 'bg-fill-success' : 'bg-fill-disabled'}
                      borderRadius="100"
                      style={{ minWidth: '24px', minHeight: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text
                        variant="bodySm"
                        as="span"
                        fontWeight="semibold"
                        tone={isCurrent ? 'base' : isCompleted ? 'text-inverse' : 'subdued'}
                      >
                        {isCompleted ? '✓' : stepNumber}
                      </Text>
                    </Box>
                    <Text
                      variant="bodySm"
                      as="span"
                      fontWeight={isCurrent ? 'semibold' : 'regular'}
                      tone={isCurrent ? 'text-inverse' : isCompleted ? 'success' : 'subdued'}
                    >
                      {step.title}
                    </Text>
                  </div>
                </Box>
              );
            })}
          </div>
        </Box>
      )}

      {/* Current Step Description */}
      <Box>
        <Text variant="bodyMd" as="p">
          <Text as="span" fontWeight="semibold">
            {SETUP_STEPS[progress.currentStep - 1]?.title}:{' '}
          </Text>
          {SETUP_STEPS[progress.currentStep - 1]?.description}
        </Text>
      </Box>
    </Box>
  );
}