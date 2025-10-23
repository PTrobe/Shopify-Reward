/**
 * Setup Layout Component
 *
 * Main layout wrapper for the setup wizard with navigation and progress tracking
 */

import React, { ReactNode } from 'react';
import {
  Page,
  Layout,
  Card,
  ButtonGroup,
  Button,
  Box,
  Text,
  Toast,
  Frame,
} from '@shopify/polaris';
import { useState } from 'react';
import { useSetup } from '../../contexts/SetupContext';
import { ProgressIndicator } from './ProgressIndicator';

interface SetupLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  showProgress?: boolean;
  allowBack?: boolean;
  allowNext?: boolean;
  nextLabel?: string;
  backLabel?: string;
  onNext?: () => void;
  onBack?: () => void;
  secondaryActions?: ReactNode;
  isLoading?: boolean;
}

export function SetupLayout({
  children,
  title,
  description,
  showProgress = true,
  allowBack = true,
  allowNext = true,
  nextLabel = 'Continue',
  backLabel = 'Back',
  onNext,
  onBack,
  secondaryActions,
  isLoading = false,
}: SetupLayoutProps) {
  const { progress, nextStep, previousStep, errors, isSaving } = useSetup();
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      try {
        nextStep();
        if (errors.length === 0) {
          showToast('Progress saved successfully!');
        }
      } catch (error) {
        showToast('Please fix the errors before continuing', true);
      }
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      previousStep();
    }
  };

  const isFirstStep = progress.currentStep === 1;
  const isLastStep = progress.currentStep === progress.totalSteps;

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      onDismiss={() => setToastActive(false)}
      error={toastError}
    />
  ) : null;

  return (
    <Frame>
      <Page
        title="Loyco Rewards Setup"
        titleMetadata={
          <Text variant="bodySm" tone="subdued" as="span">
            Configuration Wizard
          </Text>
        }
      >
        <Layout>
          {/* Progress Section */}
          {showProgress && (
            <Layout.Section>
              <ProgressIndicator allowStepNavigation={false} />
            </Layout.Section>
          )}

          {/* Main Content */}
          <Layout.Section>
            <Card>
              <Box padding="600">
                <Stack vertical spacing="loose">
                  {/* Step Header */}
                  <Box>
                    <Stack vertical spacing="tight">
                      <Text variant="headingLg" as="h1">
                        {title}
                      </Text>
                      {description && (
                        <Text variant="bodyMd" tone="subdued" as="p">
                          {description}
                        </Text>
                      )}
                    </Stack>
                  </Box>

                  {/* Error Display */}
                  {errors.length > 0 && (
                    <Box
                      padding="400"
                      background="bg-fill-critical-secondary"
                      borderColor="border-critical"
                      borderWidth="025"
                      borderRadius="200"
                    >
                      <Stack vertical spacing="tight">
                        <Text variant="bodyMd" fontWeight="semibold" tone="critical" as="p">
                          Please fix the following errors:
                        </Text>
                        <Box paddingInlineStart="400">
                          <Stack vertical spacing="extraTight">
                            {errors.map((error, index) => (
                              <Text key={index} variant="bodySm" tone="critical" as="p">
                                • {error.message}
                              </Text>
                            ))}
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  )}

                  {/* Step Content */}
                  <Box>{children}</Box>
                </Stack>
              </Box>
            </Card>
          </Layout.Section>

          {/* Navigation */}
          <Layout.Section>
            <Card>
              <Box padding="400">
                <Stack distribution="equalSpacing" alignment="center">
                  {/* Back Button */}
                  <Box>
                    {allowBack && !isFirstStep && (
                      <Button
                        onClick={handleBack}
                        disabled={isLoading || isSaving}
                      >
                        {backLabel}
                      </Button>
                    )}
                  </Box>

                  {/* Secondary Actions */}
                  <Box>
                    {secondaryActions}
                  </Box>

                  {/* Next/Continue Button */}
                  <Box>
                    {allowNext && (
                      <ButtonGroup>
                        <Button
                          variant={isLastStep ? 'primary' : 'primary'}
                          onClick={handleNext}
                          loading={isLoading || isSaving}
                          disabled={errors.length > 0}
                        >
                          {isLastStep ? '🚀 Launch Program' : nextLabel}
                        </Button>
                      </ButtonGroup>
                    )}
                  </Box>
                </Stack>

                {/* Progress Info */}
                <Box paddingBlockStart="400">
                  <Stack distribution="center">
                    <Text variant="bodySm" tone="subdued" as="p" alignment="center">
                      Step {progress.currentStep} of {progress.totalSteps}
                      {progress.estimatedTimeRemaining > 0 && (
                        <> • About {progress.estimatedTimeRemaining} minutes remaining</>
                      )}
                    </Text>
                  </Stack>
                </Box>
              </Box>
            </Card>
          </Layout.Section>

          {/* Auto-save Indicator */}
          {isSaving && (
            <Layout.Section>
              <Box paddingBlockStart="200">
                <Stack distribution="center">
                  <Text variant="bodySm" tone="subdued" as="p">
                    💾 Saving progress...
                  </Text>
                </Stack>
              </Box>
            </Layout.Section>
          )}
        </Layout>

        {toastMarkup}
      </Page>
    </Frame>
  );
}