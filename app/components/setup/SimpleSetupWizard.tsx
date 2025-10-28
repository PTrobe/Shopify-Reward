/**
 * Simple Setup Wizard - Local Persistence Version
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, useFetcher, useLoaderData } from '@remix-run/react';
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
  Checkbox,
  ChoiceList,
} from '@shopify/polaris';

interface RewardTier {
  id: string;
  name: string;
  pointsRequired: number;
  discountType: 'percentage' | 'fixed' | 'freeShipping';
  discountValue: number;
  description: string;
}

interface ThemeSummary {
  id: string;
  name: string;
  role: string;
}

interface SetupLoaderData {
  shop: string;
  themes: ThemeSummary[];
}

interface WizardState {
  step: number;
  programName: string;
  currency: string;
  programType: string;
  pointsPerDollar: number;
  signupBonus: number;
  birthdayBonus: number;
  referralBonus: number;
  reviewBonus: number;
  minimumRedemption: number;
  rewardTiers: RewardTier[];
  primaryColor: string;
  secondaryColor: string;
  pointsDisplayStyle: 'badge' | 'widget' | 'minimal';
  showInHeader: boolean;
  showOnProductPage: boolean;
  showInCart: boolean;
  selectedTheme: string;
  autoInstallBlocks: boolean;
  backupBeforeInstall: boolean;
  installationStatus: 'pending' | 'installing' | 'complete' | 'error';
  installationMessage: string;
  enableWelcomeEmail: boolean;
  enablePointsEarnedEmail: boolean;
  enableRewardAvailableEmail: boolean;
  emailFromName: string;
  emailFromAddress: string;
  programLaunched: boolean;
}

const TOTAL_STEPS = 8;
const LOCAL_STORAGE_VERSION = 'v2';

const BASE_REWARD_TIERS: RewardTier[] = [
  {
    id: '1',
    name: '$5 Off',
    pointsRequired: 500,
    discountType: 'fixed',
    discountValue: 5,
    description: '$5 off your next purchase',
  },
  {
    id: '2',
    name: '10% Off',
    pointsRequired: 1000,
    discountType: 'percentage',
    discountValue: 10,
    description: '10% off your entire order',
  },
  {
    id: '3',
    name: 'Free Shipping',
    pointsRequired: 750,
    discountType: 'freeShipping',
    discountValue: 0,
    description: 'Free shipping on your next order',
  },
];

function buildInitialState(): WizardState {
  return {
    step: 1,
    programName: '',
    currency: 'points',
    programType: 'points-based',
    pointsPerDollar: 1,
    signupBonus: 100,
    birthdayBonus: 50,
    referralBonus: 200,
    reviewBonus: 25,
    minimumRedemption: 100,
    rewardTiers: BASE_REWARD_TIERS.map((tier) => ({ ...tier })),
    primaryColor: '#FFD700',
    secondaryColor: '#B8860B',
    pointsDisplayStyle: 'badge',
    showInHeader: true,
    showOnProductPage: true,
    showInCart: false,
    selectedTheme: '',
    autoInstallBlocks: true,
    backupBeforeInstall: true,
    installationStatus: 'pending',
    installationMessage: '',
    enableWelcomeEmail: true,
    enablePointsEarnedEmail: true,
    enableRewardAvailableEmail: true,
    emailFromName: '',
    emailFromAddress: '',
    programLaunched: false,
  };
}

export function SimpleSetupWizard() {
  const loaderData = useLoaderData<SetupLoaderData>();
  const installFetcher = useFetcher();
  const persistenceKey = useMemo(
    () => `loyco-setup-${LOCAL_STORAGE_VERSION}-${loaderData.shop}`,
    [loaderData.shop],
  );

  const [state, setState] = useState<WizardState>(() => buildInitialState());
  const [errors, setErrors] = useState<string[]>([]);

  const availableThemes = loaderData.themes;

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(persistenceKey);
      if (stored) {
        const parsed = JSON.parse(stored) as WizardState;
        const adjusted = {
          ...buildInitialState(),
          ...parsed,
        };

        if (adjusted.installationStatus === 'installing') {
          adjusted.installationStatus = 'pending';
          adjusted.installationMessage = '';
        }

        setState(adjusted);
      }
    } catch (error) {
      console.warn('Failed to hydrate setup state', error);
    }
  }, [persistenceKey]);

  // Persist whenever state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(persistenceKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist setup state', error);
    }
  }, [state, persistenceKey]);

  const setStep = (step: number) => {
    setState((prev) => ({ ...prev, step }));
  };

  const updateField = (field: keyof WizardState, value: unknown) => {
    setState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateCurrentState = (current: WizardState) => {
    const validationErrors: string[] = [];

    if (current.step === 1) {
      if (!current.programName.trim()) {
        validationErrors.push('Program name is required');
      }
    }

    if (current.step === 2) {
      if (current.pointsPerDollar <= 0) {
        validationErrors.push('Points per dollar must be greater than 0');
      }
      if (current.minimumRedemption <= 0) {
        validationErrors.push('Minimum redemption must be greater than 0');
      }
    }

    if (current.step === 5 && !current.selectedTheme) {
      validationErrors.push('Choose a theme to install into');
    }

    return validationErrors;
  };

  const nextStep = () => {
    const validationErrors = validateCurrentState(state);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setStep(Math.min(state.step + 1, TOTAL_STEPS));
  };

  const prevStep = () => {
    setErrors([]);
    setStep(Math.max(state.step - 1, 1));
  };

  const installThemeBlocks = () => {
    const selectedTheme =
      state.selectedTheme ||
      availableThemes.find((theme) => theme.role === 'main')?.id ||
      availableThemes[0]?.id || '';

    if (!selectedTheme) {
      setErrors(['No available theme to install into.']);
      return;
    }

    setState((prev) => ({
      ...prev,
      selectedTheme,
      installationStatus: 'installing',
      installationMessage: '',
    }));

    const selectedThemeName = availableThemes.find((theme) => theme.id === selectedTheme)?.name || 'Selected theme';

    installFetcher.submit(
      {
        action: 'install_all',
        themeId: selectedTheme,
        themeName: selectedThemeName,
      },
      { method: 'post' },
    );
  };

  useEffect(() => {
    if (installFetcher.state === 'idle' && installFetcher.data) {
      if (installFetcher.data.success) {
        setState((prev) => ({
          ...prev,
          installationStatus: 'complete',
          installationMessage: installFetcher.data.message || 'Loyalty blocks installed successfully.',
        }));

        setTimeout(() => {
          setStep(Math.min(state.step + 1, TOTAL_STEPS));
        }, 1200);
      } else {
        setState((prev) => ({
          ...prev,
          installationStatus: 'error',
          installationMessage: installFetcher.data.message || installFetcher.data.error || 'Theme installation failed. Please try again.',
        }));
      }
    }
  }, [installFetcher.state, installFetcher.data]);

  const launchProgram = () => {
    setState((prev) => ({ ...prev, programLaunched: true }));
  };

  // Keep theme selection in sync with loader data
  useEffect(() => {
    if (!state.selectedTheme && availableThemes.length > 0) {
      const mainTheme = availableThemes.find((theme) => theme.role === 'main');
      const selectedThemeId = mainTheme?.id || availableThemes[0]?.id || '';

      setState((prev) => ({
        ...prev,
        selectedTheme: selectedThemeId,
      }));
    }
  }, [availableThemes, state.selectedTheme]);

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
                          options={[
                            { label: 'Points', value: 'points' },
                            { label: 'Coins', value: 'coins' },
                            { label: 'Stars', value: 'stars' },
                            { label: 'Credits', value: 'credits' },
                          ]}
                          value={state.currency}
                          onChange={(value) => updateField('currency', value)}
                        />
                        <Select
                          label="Program Type"
                          options={[
                            { label: 'Points-based', value: 'points-based' },
                            { label: 'Tier-based', value: 'tier-based' },
                            { label: 'Cashback', value: 'cashback' },
                          ]}
                          value={state.programType}
                          onChange={(value) => updateField('programType', value)}
                        />
                      </FormLayout.Group>
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>
          </Box>
        );

      case 5:
        return (
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h3">
                Install Loyalty Program Blocks
              </Text>

              <Box paddingBlockStart="300">
                <FormLayout>
                  <Select
                    label="Select theme"
                    options={availableThemes.map((theme) => ({
                      label: `${theme.name}${theme.role === 'main' ? ' (Published)' : ''}`,
                      value: theme.id,
                    }))}
                    value={state.selectedTheme}
                    onChange={(value) => updateField('selectedTheme', value)}
                  />
                  <Checkbox
                    label="Create backup before installation"
                    checked={state.backupBeforeInstall}
                    onChange={(checked) => updateField('backupBeforeInstall', checked)}
                  />
                </FormLayout>
              </Box>

              <Box paddingBlockStart="400">
                <Button
                  variant="primary"
                  onClick={installThemeBlocks}
                  loading={state.installationStatus === 'installing'}
                >
                  Install loyalty blocks
                </Button>
              </Box>

              {state.installationMessage && (
                <Box paddingBlockStart="300">
                  <Banner
                    title={state.installationMessage}
                    tone={state.installationStatus === 'error' ? 'critical' : 'success'}
                  />
                </Box>
              )}
            </Box>
          </Card>
        );

      default:
        return (
          <Card>
            <Box padding="400">
              <Text variant="bodyMd" as="p">
                Step {state.step} content placeholder.
              </Text>
            </Box>
          </Card>
        );
    }
  };

  return (
    <Frame>
      <Page title="Loyco Rewards Setup" subtitle="Configuration Wizard">
        <Layout>
          <Layout.Section>
            <Card>
              <Box padding="400">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <Text variant="headingMd" as="h2">
                    Program Setup
                  </Text>
                  <Badge tone="info">{Math.round(progress)}% Complete</Badge>
                </div>
                <ProgressBar progress={progress} size="large" />
                <Box paddingBlockStart="200">
                  <Text variant="bodySm" tone="subdued" as="p">
                    Step {state.step} of {TOTAL_STEPS}
                  </Text>
                </Box>
              </Box>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Box>
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

              {renderStepContent()}
            </Box>
          </Layout.Section>

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
                      {isLastStep ? (
                        !state.programLaunched ? (
                          <Form method="post">
                            <Button variant="primary" submit>
                              Launch Program
                            </Button>
                          </Form>
                        ) : (
                          <Button variant="primary" onClick={() => window.location.href = '/app'}>
                            Go to Dashboard
                          </Button>
                        )
                      ) : (
                        <Button variant="primary" onClick={nextStep}>
                          Continue
                        </Button>
                      )}
                    </ButtonGroup>
                  </Box>
                </div>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
