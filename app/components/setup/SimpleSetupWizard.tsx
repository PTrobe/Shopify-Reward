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

      case 2:
        return (
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h3">
                Points Configuration
              </Text>
              <Box paddingBlockStart="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Configure how customers earn points in your loyalty program
                </Text>
              </Box>

              <Box paddingBlockStart="400">
                <FormLayout>
                  <TextField
                    label="Points per dollar spent"
                    type="number"
                    value={String(state.pointsPerDollar)}
                    onChange={(value) => updateField('pointsPerDollar', Number(value) || 0)}
                    helpText="How many points customers earn for each dollar spent"
                    autoComplete="off"
                    min={0}
                  />
                  <FormLayout.Group condensed>
                    <TextField
                      label="Signup bonus"
                      type="number"
                      value={String(state.signupBonus)}
                      onChange={(value) => updateField('signupBonus', Number(value) || 0)}
                      helpText="Points awarded when customers join"
                      autoComplete="off"
                      min={0}
                    />
                    <TextField
                      label="Birthday bonus"
                      type="number"
                      value={String(state.birthdayBonus)}
                      onChange={(value) => updateField('birthdayBonus', Number(value) || 0)}
                      helpText="Points awarded on customer's birthday"
                      autoComplete="off"
                      min={0}
                    />
                  </FormLayout.Group>
                  <FormLayout.Group condensed>
                    <TextField
                      label="Referral bonus"
                      type="number"
                      value={String(state.referralBonus)}
                      onChange={(value) => updateField('referralBonus', Number(value) || 0)}
                      helpText="Points for referring a friend"
                      autoComplete="off"
                      min={0}
                    />
                    <TextField
                      label="Review bonus"
                      type="number"
                      value={String(state.reviewBonus)}
                      onChange={(value) => updateField('reviewBonus', Number(value) || 0)}
                      helpText="Points for writing a product review"
                      autoComplete="off"
                      min={0}
                    />
                  </FormLayout.Group>
                  <TextField
                    label="Minimum points for redemption"
                    type="number"
                    value={String(state.minimumRedemption)}
                    onChange={(value) => updateField('minimumRedemption', Number(value) || 0)}
                    helpText="Minimum points required before customers can redeem rewards"
                    autoComplete="off"
                    min={0}
                  />
                </FormLayout>
              </Box>
            </Box>
          </Card>
        );

      case 3:
        return (
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h3">
                Reward Tiers
              </Text>
              <Box paddingBlockStart="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Configure the rewards customers can redeem with their points
                </Text>
              </Box>

              <Box paddingBlockStart="400">
                <Banner tone="info">
                  <p>Default reward tiers have been configured. You can customize these later in the dashboard.</p>
                </Banner>
              </Box>

              <Box paddingBlockStart="400">
                {state.rewardTiers.map((tier, index) => (
                  <Box key={tier.id} paddingBlockEnd="300">
                    <Card>
                      <Box padding="300">
                        <Text variant="headingSm" as="h4">
                          {tier.name}
                        </Text>
                        <Box paddingBlockStart="200">
                          <Text variant="bodySm" as="p" tone="subdued">
                            {tier.pointsRequired} points • {tier.description}
                          </Text>
                        </Box>
                      </Box>
                    </Card>
                  </Box>
                ))}
              </Box>
            </Box>
          </Card>
        );

      case 4:
        return (
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h3">
                Display Settings
              </Text>
              <Box paddingBlockStart="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Customize how the loyalty program appears to your customers
                </Text>
              </Box>

              <Box paddingBlockStart="400">
                <FormLayout>
                  <FormLayout.Group condensed>
                    <TextField
                      label="Primary color"
                      value={state.primaryColor}
                      onChange={(value) => updateField('primaryColor', value)}
                      helpText="Main brand color for loyalty widgets (e.g., #FF5733)"
                      autoComplete="off"
                      placeholder="#000000"
                    />
                    <TextField
                      label="Secondary color"
                      value={state.secondaryColor}
                      onChange={(value) => updateField('secondaryColor', value)}
                      helpText="Accent color for buttons and highlights (e.g., #33FF57)"
                      autoComplete="off"
                      placeholder="#FFFFFF"
                    />
                  </FormLayout.Group>
                  <Select
                    label="Points display style"
                    options={[
                      { label: 'Badge', value: 'badge' },
                      { label: 'Widget', value: 'widget' },
                      { label: 'Minimal', value: 'minimal' },
                    ]}
                    value={state.pointsDisplayStyle}
                    onChange={(value) => updateField('pointsDisplayStyle', value)}
                    helpText="How points are displayed to customers"
                  />
                  <Box paddingBlockStart="300">
                    <Text variant="headingSm" as="h4">
                      Visibility Options
                    </Text>
                    <Box paddingBlockStart="200">
                      <Checkbox
                        label="Show points balance in header"
                        checked={state.showInHeader}
                        onChange={(checked) => updateField('showInHeader', checked)}
                      />
                      <Box paddingBlockStart="200">
                        <Checkbox
                          label="Show points earning on product pages"
                          checked={state.showOnProductPage}
                          onChange={(checked) => updateField('showOnProductPage', checked)}
                        />
                      </Box>
                      <Box paddingBlockStart="200">
                        <Checkbox
                          label="Show points summary in cart"
                          checked={state.showInCart}
                          onChange={(checked) => updateField('showInCart', checked)}
                        />
                      </Box>
                    </Box>
                  </Box>
                </FormLayout>
              </Box>
            </Box>
          </Card>
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

      case 6:
        return (
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h3">
                Email Notifications
              </Text>
              <Box paddingBlockStart="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Configure automated email notifications for your loyalty program
                </Text>
              </Box>

              <Box paddingBlockStart="400">
                <FormLayout>
                  <Box>
                    <Text variant="headingSm" as="h4">
                      Email Types
                    </Text>
                    <Box paddingBlockStart="200">
                      <Checkbox
                        label="Welcome email when customers join"
                        checked={state.enableWelcomeEmail}
                        onChange={(checked) => updateField('enableWelcomeEmail', checked)}
                      />
                      <Box paddingBlockStart="200">
                        <Checkbox
                          label="Notification when points are earned"
                          checked={state.enablePointsEarnedEmail}
                          onChange={(checked) => updateField('enablePointsEarnedEmail', checked)}
                        />
                      </Box>
                      <Box paddingBlockStart="200">
                        <Checkbox
                          label="Notification when rewards are available"
                          checked={state.enableRewardAvailableEmail}
                          onChange={(checked) => updateField('enableRewardAvailableEmail', checked)}
                        />
                      </Box>
                    </Box>
                  </Box>
                  <FormLayout.Group condensed>
                    <TextField
                      label="From name"
                      value={state.emailFromName}
                      onChange={(value) => updateField('emailFromName', value)}
                      helpText="Name shown in email sender"
                      autoComplete="off"
                    />
                    <TextField
                      label="From email address"
                      type="email"
                      value={state.emailFromAddress}
                      onChange={(value) => updateField('emailFromAddress', value)}
                      helpText="Email address for sending notifications"
                      autoComplete="off"
                    />
                  </FormLayout.Group>
                </FormLayout>
              </Box>
            </Box>
          </Card>
        );

      case 7:
        return (
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h3">
                Review Your Configuration
              </Text>
              <Box paddingBlockStart="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Review your loyalty program settings before launching
                </Text>
              </Box>

              <Box paddingBlockStart="400">
                <Card>
                  <Box padding="300">
                    <Text variant="headingSm" as="h4">
                      Program Information
                    </Text>
                    <Box paddingBlockStart="200">
                      <Text variant="bodySm" as="p">
                        <strong>Name:</strong> {state.programName || 'Not set'}
                      </Text>
                      <Text variant="bodySm" as="p">
                        <strong>Currency:</strong> {state.currency}
                      </Text>
                      <Text variant="bodySm" as="p">
                        <strong>Type:</strong> {state.programType}
                      </Text>
                    </Box>
                  </Box>
                </Card>

                <Box paddingBlockStart="300">
                  <Card>
                    <Box padding="300">
                      <Text variant="headingSm" as="h4">
                        Points Configuration
                      </Text>
                      <Box paddingBlockStart="200">
                        <Text variant="bodySm" as="p">
                          <strong>Points per dollar:</strong> {state.pointsPerDollar}
                        </Text>
                        <Text variant="bodySm" as="p">
                          <strong>Signup bonus:</strong> {state.signupBonus} points
                        </Text>
                        <Text variant="bodySm" as="p">
                          <strong>Minimum redemption:</strong> {state.minimumRedemption} points
                        </Text>
                      </Box>
                    </Box>
                  </Card>
                </Box>

                <Box paddingBlockStart="300">
                  <Card>
                    <Box padding="300">
                      <Text variant="headingSm" as="h4">
                        Reward Tiers
                      </Text>
                      <Box paddingBlockStart="200">
                        <Text variant="bodySm" as="p">
                          {state.rewardTiers.length} reward tiers configured
                        </Text>
                      </Box>
                    </Box>
                  </Card>
                </Box>

                <Box paddingBlockStart="300">
                  <Card>
                    <Box padding="300">
                      <Text variant="headingSm" as="h4">
                        Theme Installation
                      </Text>
                      <Box paddingBlockStart="200">
                        <Text variant="bodySm" as="p">
                          <strong>Status:</strong> {state.installationStatus === 'complete' ? 'Installed' : 'Not installed'}
                        </Text>
                      </Box>
                    </Box>
                  </Card>
                </Box>
              </Box>
            </Box>
          </Card>
        );

      case 8:
        return (
          <Card>
            <Box padding="400">
              <Text variant="headingMd" as="h3">
                Ready to Launch!
              </Text>
              <Box paddingBlockStart="200">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Your loyalty program is configured and ready to go live
                </Text>
              </Box>

              <Box paddingBlockStart="400">
                <Banner tone="success">
                  <p>
                    Click "Launch Program" below to activate your loyalty program and start rewarding your customers.
                  </p>
                </Banner>
              </Box>

              <Box paddingBlockStart="400">
                <Card>
                  <Box padding="300">
                    <Text variant="headingSm" as="h4">
                      What happens next?
                    </Text>
                    <Box paddingBlockStart="200">
                      <ul>
                        <li>Your loyalty program will be activated</li>
                        <li>Customers can start earning and redeeming points</li>
                        <li>Email notifications will be sent based on your settings</li>
                        <li>You can manage everything from the dashboard</li>
                      </ul>
                    </Box>
                  </Box>
                </Card>
              </Box>
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
