/**
 * Simple Setup Wizard - Phase 1 Implementation
 *
 * A working setup wizard that demonstrates the infrastructure
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from '@remix-run/react';
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

interface WizardState {
  step: number;
  programName: string;
  currency: string;
  programType: string;
  // Points Configuration
  pointsPerDollar: number;
  signupBonus: number;
  birthdayBonus: number;
  referralBonus: number;
  reviewBonus: number;
  minimumRedemption: number;
  // Reward Tiers
  rewardTiers: RewardTier[];
  // Visual Customization
  primaryColor: string;
  secondaryColor: string;
  pointsDisplayStyle: 'badge' | 'widget' | 'minimal';
  showInHeader: boolean;
  showOnProductPage: boolean;
  showInCart: boolean;
  // Theme Integration
  selectedTheme: string;
  autoInstallBlocks: boolean;
  backupBeforeInstall: boolean;
  installationStatus: 'pending' | 'installing' | 'complete' | 'error';
  installationMessage: string;
  // Email Notifications
  enableWelcomeEmail: boolean;
  enablePointsEarnedEmail: boolean;
  enableRewardAvailableEmail: boolean;
  emailFromName: string;
  emailFromAddress: string;
  // Program Launch
  programLaunched: boolean;
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
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<WizardState>({
    step: 1,
    programName: '',
    currency: 'points',
    programType: 'points-based',
    // Points Configuration defaults
    pointsPerDollar: 1,
    signupBonus: 100,
    birthdayBonus: 50,
    referralBonus: 200,
    reviewBonus: 25,
    minimumRedemption: 100,
    // Reward Tiers defaults
    rewardTiers: [
      {
        id: '1',
        name: '$5 Off',
        pointsRequired: 500,
        discountType: 'fixed',
        discountValue: 5,
        description: '$5 off your next purchase'
      },
      {
        id: '2',
        name: '10% Off',
        pointsRequired: 1000,
        discountType: 'percentage',
        discountValue: 10,
        description: '10% off your entire order'
      },
      {
        id: '3',
        name: 'Free Shipping',
        pointsRequired: 750,
        discountType: 'freeShipping',
        discountValue: 0,
        description: 'Free shipping on your next order'
      }
    ],
    // Visual Customization defaults
    primaryColor: '#FFD700',
    secondaryColor: '#B8860B',
    pointsDisplayStyle: 'badge',
    showInHeader: true,
    showOnProductPage: true,
    showInCart: false,
    // Theme Integration defaults
    selectedTheme: '',
    autoInstallBlocks: true,
    backupBeforeInstall: true,
    installationStatus: 'pending',
    installationMessage: '',
    // Email Notifications defaults
    enableWelcomeEmail: true,
    enablePointsEarnedEmail: true,
    enableRewardAvailableEmail: true,
    emailFromName: '',
    emailFromAddress: '',
    // Program Launch defaults
    programLaunched: false,
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [availableThemes, setAvailableThemes] = useState<Array<{id: string, name: string, role: string}>>([]);

  // Fetch real themes when component mounts
  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const response = await fetch('/api/admin/theme');
        const result = await response.json();
        if (result.themes) {
          const normalizedThemes = result.themes.map((theme: any) => ({
            id: String(theme.id),
            name: theme.name,
            role: theme.role,
          }));

          setAvailableThemes(normalizedThemes);
          setState((prev) => ({
            ...prev,
            selectedTheme:
              prev.selectedTheme ||
              normalizedThemes.find((theme) => theme.role === 'main')?.id ||
              normalizedThemes[0]?.id ||
              '',
          }));
        }
      } catch (error) {
        console.error('Failed to fetch themes:', error);
        // Fallback to mock themes
        const fallbackThemes = [
          { id: 'dawn', name: 'Dawn', role: 'main' },
          { id: 'refresh', name: 'Refresh', role: 'unpublished' },
        ];
        setAvailableThemes(fallbackThemes);
        setState((prev) => ({
          ...prev,
          selectedTheme:
            prev.selectedTheme ||
            fallbackThemes.find((theme) => theme.role === 'main')?.id ||
            fallbackThemes[0]?.id ||
            '',
        }));
      }
    };

    fetchThemes();
  }, []);

  // Validation function that can be called anytime
  const validateCurrentStep = (currentState: WizardState): string[] => {
    const newErrors: string[] = [];

    if (currentState.step === 1) {
      if (!currentState.programName.trim()) {
        newErrors.push('Program name is required');
      }
      if (currentState.programName.length > 50) {
        newErrors.push('Program name must be 50 characters or less');
      }
    }

    if (currentState.step === 2) {
      if (currentState.pointsPerDollar <= 0) {
        newErrors.push('Points per dollar must be greater than 0');
      }
      if (currentState.minimumRedemption <= 0) {
        newErrors.push('Minimum redemption must be greater than 0');
      }
      if (currentState.signupBonus < 0) {
        newErrors.push('Signup bonus cannot be negative');
      }
    }

    if (currentState.step === 3) {
      if (currentState.rewardTiers.length === 0) {
        newErrors.push('At least one reward tier is required');
      }
      currentState.rewardTiers.forEach((tier, index) => {
        if (!tier.name.trim()) {
          newErrors.push(`Reward tier ${index + 1} name is required`);
        }
        if (tier.pointsRequired <= 0) {
          newErrors.push(`Reward tier ${index + 1} must require at least 1 point`);
        }
        if (tier.discountType !== 'freeShipping' && tier.discountValue <= 0) {
          newErrors.push(`Reward tier ${index + 1} discount value must be greater than 0`);
        }
      });
    }

    if (currentState.step === 4) {
      if (!currentState.primaryColor || !currentState.primaryColor.startsWith('#')) {
        newErrors.push('Primary color must be a valid hex color');
      }
      if (!currentState.secondaryColor || !currentState.secondaryColor.startsWith('#')) {
        newErrors.push('Secondary color must be a valid hex color');
      }
    }

    if (currentState.step === 5) {
      if (!currentState.selectedTheme) {
        newErrors.push('Please select a theme for installation');
      }
    }

    if (currentState.step === 6) {
      if (!currentState.emailFromName.trim()) {
        newErrors.push('Email sender name is required');
      }
      if (!currentState.emailFromAddress.trim()) {
        newErrors.push('Email sender address is required');
      }
      if (currentState.emailFromAddress && !currentState.emailFromAddress.includes('@')) {
        newErrors.push('Please enter a valid email address');
      }
    }

    return newErrors;
  };

  const nextStep = () => {
    const newErrors = validateCurrentStep(state);

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

  const updateField = (field: keyof WizardState, value: string | number | boolean) => {
    const newState = { ...state, [field]: value };
    setState(newState);
    // Real-time validation: check if current errors are still valid
    const currentErrors = validateCurrentStep(newState);
    setErrors(currentErrors);
  };

  const updateNumberField = (field: keyof WizardState, value: string) => {
    const numValue = parseFloat(value) || 0;
    updateField(field, numValue);
  };

  const updateRewardTier = (index: number, field: keyof RewardTier, value: string | number) => {
    const newState = {
      ...state,
      rewardTiers: state.rewardTiers.map((tier, i) =>
        i === index ? { ...tier, [field]: value } : tier
      )
    };
    setState(newState);
    // Real-time validation: check if current errors are still valid
    const currentErrors = validateCurrentStep(newState);
    setErrors(currentErrors);
  };

  const addRewardTier = () => {
    const newTier: RewardTier = {
      id: Date.now().toString(),
      name: '',
      pointsRequired: 100,
      discountType: 'percentage',
      discountValue: 5,
      description: ''
    };
    const newState = {
      ...state,
      rewardTiers: [...state.rewardTiers, newTier]
    };
    setState(newState);
    // Real-time validation: check if current errors are still valid
    const currentErrors = validateCurrentStep(newState);
    setErrors(currentErrors);
  };

  const removeRewardTier = (index: number) => {
    const newState = {
      ...state,
      rewardTiers: state.rewardTiers.filter((_, i) => i !== index)
    };
    setState(newState);
    // Real-time validation: check if current errors are still valid
    const currentErrors = validateCurrentStep(newState);
    setErrors(currentErrors);
  };

  const installThemeBlocks = async () => {
    const selectedThemeId =
      state.selectedTheme ||
      availableThemes.find((theme) => theme.role === 'main')?.id ||
      availableThemes[0]?.id;

    if (!selectedThemeId) {
      setErrors(['No available theme to install into.']);
      return;
    }

    setState((prev) => ({
      ...prev,
      installationStatus: 'installing',
      installationMessage: '',
    }));

    try {
      const formData = new FormData();
      formData.append('action', 'install_all');
      formData.append('themeId', selectedThemeId);

      const response = await fetch('/api/admin/theme', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result?.success) {
        setState((prev) => ({
          ...prev,
          selectedTheme: selectedThemeId,
          installationStatus: 'complete',
          installationMessage: result.message || 'Loyalty blocks installed successfully.',
        }));

        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            step: Math.min(prev.step + 1, TOTAL_STEPS),
          }));
        }, 1800);
      } else {
        const message =
          result?.error || result?.message || 'Theme installation failed. Please try again.';
        console.error('Theme installation failed:', result);
        setState((prev) => ({
          ...prev,
          installationStatus: 'error',
          installationMessage: message,
        }));
      }
    } catch (error) {
      console.error('Theme installation error:', error);
      setState((prev) => ({
        ...prev,
        installationStatus: 'error',
        installationMessage: 'Unexpected error while installing loyalty blocks.',
      }));
    }
  };

  const launchProgram = () => {
    // Mark program as launched
    setState(prev => ({ ...prev, programLaunched: true }));
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

      case 2:
        return (
          <Box>
            <Banner title="Configure your points system" tone="info">
              <p>Set up how customers earn and redeem {state.currency} in your loyalty program.</p>
            </Banner>

            <Box paddingBlockStart="500">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Earning Points
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <FormLayout.Group condensed>
                        <TextField
                          label={`${state.currency.charAt(0).toUpperCase() + state.currency.slice(1)} per $1 spent`}
                          type="number"
                          value={state.pointsPerDollar.toString()}
                          onChange={(value) => updateNumberField('pointsPerDollar', value)}
                          helpText="Base earning rate for purchases"
                          autoComplete="off"
                        />
                        <TextField
                          label={`Minimum ${state.currency} to redeem`}
                          type="number"
                          value={state.minimumRedemption.toString()}
                          onChange={(value) => updateNumberField('minimumRedemption', value)}
                          helpText="Minimum points needed for redemption"
                          autoComplete="off"
                        />
                      </FormLayout.Group>
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>

            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Bonus Points
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <FormLayout.Group condensed>
                        <TextField
                          label={`Account signup bonus`}
                          type="number"
                          value={state.signupBonus.toString()}
                          onChange={(value) => updateNumberField('signupBonus', value)}
                          helpText="One-time welcome bonus"
                          suffix={state.currency}
                          autoComplete="off"
                        />
                        <TextField
                          label={`Birthday bonus`}
                          type="number"
                          value={state.birthdayBonus.toString()}
                          onChange={(value) => updateNumberField('birthdayBonus', value)}
                          helpText="Annual birthday reward"
                          suffix={state.currency}
                          autoComplete="off"
                        />
                      </FormLayout.Group>
                      <FormLayout.Group condensed>
                        <TextField
                          label={`Referral bonus`}
                          type="number"
                          value={state.referralBonus.toString()}
                          onChange={(value) => updateNumberField('referralBonus', value)}
                          helpText="Reward for successful referrals"
                          suffix={state.currency}
                          autoComplete="off"
                        />
                        <TextField
                          label={`Product review bonus`}
                          type="number"
                          value={state.reviewBonus.toString()}
                          onChange={(value) => updateNumberField('reviewBonus', value)}
                          helpText="Reward for writing reviews"
                          suffix={state.currency}
                          autoComplete="off"
                        />
                      </FormLayout.Group>
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>

            {/* Preview Section */}
            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h4">
                    Preview: Customer Earning Potential
                  </Text>
                  <Box paddingBlockStart="300">
                    <Box
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text variant="bodyMd" as="span">$100 purchase</Text>
                          <Text variant="bodyMd" fontWeight="semibold" as="span">
                            +{state.pointsPerDollar * 100} {state.currency}
                          </Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text variant="bodyMd" as="span">Account signup</Text>
                          <Text variant="bodyMd" fontWeight="semibold" as="span">
                            +{state.signupBonus} {state.currency}
                          </Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text variant="bodyMd" as="span">Birthday bonus</Text>
                          <Text variant="bodyMd" fontWeight="semibold" as="span">
                            +{state.birthdayBonus} {state.currency}
                          </Text>
                        </div>
                        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                          <Text variant="bodyMd" fontWeight="semibold" as="span">Can redeem when reaching:</Text>
                          <Text variant="bodyMd" fontWeight="bold" as="span">
                            {state.minimumRedemption} {state.currency}
                          </Text>
                        </div>
                      </div>
                    </Box>
                  </Box>
                </Box>
              </Card>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Banner title="Set up reward tiers" tone="info">
              <p>Define what customers can redeem with their {state.currency}. Create rewards that motivate purchases and build loyalty.</p>
            </Banner>

            <Box paddingBlockStart="500">
              <Card>
                <Box padding="400">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <Text variant="headingMd" as="h3">
                      Reward Tiers
                    </Text>
                    <Button variant="primary" onClick={addRewardTier}>
                      Add Reward
                    </Button>
                  </div>

                  <Box paddingBlockStart="400">
                    <div style={{ display: 'grid', gap: '16px' }}>
                      {state.rewardTiers.map((tier, index) => (
                        <Card key={tier.id}>
                          <Box padding="400">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <Text variant="headingSm" as="h4">
                                Reward {index + 1}
                              </Text>
                              {state.rewardTiers.length > 1 && (
                                <Button
                                  variant="tertiary"
                                  tone="critical"
                                  onClick={() => removeRewardTier(index)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>

                            <FormLayout>
                              <FormLayout.Group condensed>
                                <TextField
                                  label="Reward Name"
                                  value={tier.name}
                                  onChange={(value) => updateRewardTier(index, 'name', value)}
                                  placeholder="e.g., $5 Off, Free Shipping"
                                  autoComplete="off"
                                />
                                <TextField
                                  label={`${state.currency.charAt(0).toUpperCase() + state.currency.slice(1)} Required`}
                                  type="number"
                                  value={tier.pointsRequired.toString()}
                                  onChange={(value) => updateRewardTier(index, 'pointsRequired', parseFloat(value) || 0)}
                                  autoComplete="off"
                                />
                              </FormLayout.Group>

                              <FormLayout.Group condensed>
                                <Select
                                  label="Discount Type"
                                  options={[
                                    { label: 'Percentage Off', value: 'percentage' },
                                    { label: 'Fixed Amount Off', value: 'fixed' },
                                    { label: 'Free Shipping', value: 'freeShipping' }
                                  ]}
                                  value={tier.discountType}
                                  onChange={(value) => updateRewardTier(index, 'discountType', value as 'percentage' | 'fixed' | 'freeShipping')}
                                />
                                {tier.discountType !== 'freeShipping' && (
                                  <TextField
                                    label={tier.discountType === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
                                    type="number"
                                    value={tier.discountValue.toString()}
                                    onChange={(value) => updateRewardTier(index, 'discountValue', parseFloat(value) || 0)}
                                    suffix={tier.discountType === 'percentage' ? '%' : '$'}
                                    autoComplete="off"
                                  />
                                )}
                              </FormLayout.Group>

                              <TextField
                                label="Description"
                                value={tier.description}
                                onChange={(value) => updateRewardTier(index, 'description', value)}
                                placeholder="Describe this reward for customers"
                                multiline={2}
                                autoComplete="off"
                              />

                              {/* Preview */}
                              <Box paddingBlockStart="300">
                                <Box
                                  padding="300"
                                  background="bg-surface-secondary"
                                  borderRadius="200"
                                >
                                  <Text variant="bodySm" fontWeight="semibold" as="p">
                                    Customer sees: {tier.name || 'Reward Name'}
                                  </Text>
                                  <Text variant="bodySm" tone="subdued" as="p">
                                    Cost: {tier.pointsRequired} {state.currency}
                                  </Text>
                                  {tier.description && (
                                    <Text variant="bodySm" as="p">
                                      {tier.description}
                                    </Text>
                                  )}
                                </Box>
                              </Box>
                            </FormLayout>
                          </Box>
                        </Card>
                      ))}
                    </div>
                  </Box>
                </Box>
              </Card>
            </Box>

            {/* Summary Preview */}
            {state.rewardTiers.length > 0 && (
              <Box paddingBlockStart="400">
                <Card>
                  <Box padding="400">
                    <Text variant="headingMd" as="h4">
                      Rewards Summary
                    </Text>
                    <Box paddingBlockStart="300">
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Box paddingBlockEnd="300">
                          <Text variant="bodyMd" fontWeight="semibold" as="p">
                            Available Rewards:
                          </Text>
                        </Box>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {state.rewardTiers
                            .sort((a, b) => a.pointsRequired - b.pointsRequired)
                            .map((tier, index) => (
                              <div key={tier.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text variant="bodyMd" as="span">
                                  {tier.name || `Reward ${index + 1}`}
                                </Text>
                                <Text variant="bodyMd" fontWeight="semibold" as="span">
                                  {tier.pointsRequired} {state.currency}
                                </Text>
                              </div>
                            ))}
                        </div>
                      </Box>
                    </Box>
                  </Box>
                </Card>
              </Box>
            )}
          </Box>
        );

      case 4:
        return (
          <Box>
            <Banner title="Customize your loyalty program design" tone="info">
              <p>Configure how your loyalty program appears on your storefront. Match your brand colors and choose where to display points.</p>
            </Banner>

            <Box paddingBlockStart="500">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Brand Colors
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <FormLayout.Group condensed>
                        <div>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500' }}>
                            Primary Color
                          </label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={state.primaryColor}
                              onChange={(e) => updateField('primaryColor', e.target.value)}
                              style={{
                                width: '40px',
                                height: '32px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            />
                            <TextField
                              value={state.primaryColor}
                              onChange={(value) => updateField('primaryColor', value)}
                              placeholder="#FFD700"
                              label=""
                              labelHidden
                              autoComplete="off"
                            />
                          </div>
                          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                            Main color for points display and rewards
                          </p>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500' }}>
                            Secondary Color
                          </label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={state.secondaryColor}
                              onChange={(e) => updateField('secondaryColor', e.target.value)}
                              style={{
                                width: '40px',
                                height: '32px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            />
                            <TextField
                              value={state.secondaryColor}
                              onChange={(value) => updateField('secondaryColor', value)}
                              placeholder="#B8860B"
                              label=""
                              labelHidden
                              autoComplete="off"
                            />
                          </div>
                          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                            Text color and accents
                          </p>
                        </div>
                      </FormLayout.Group>
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>

            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Display Style
                  </Text>
                  <Box paddingBlockStart="400">
                    <ChoiceList
                      title=""
                      choices={[
                        {
                          label: 'Badge - Compact star + points number',
                          value: 'badge',
                          helpText: 'Best for headers and minimal spaces'
                        },
                        {
                          label: 'Widget - Full points display with text',
                          value: 'widget',
                          helpText: 'Best for sidebars and dedicated areas'
                        },
                        {
                          label: 'Minimal - Just the points number',
                          value: 'minimal',
                          helpText: 'Most subtle integration'
                        }
                      ]}
                      selected={[state.pointsDisplayStyle]}
                      onChange={(value) => updateField('pointsDisplayStyle', value[0])}
                    />
                  </Box>
                </Box>
              </Card>
            </Box>

            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Display Locations
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <Checkbox
                        label="Show in header"
                        checked={state.showInHeader}
                        onChange={(checked) => updateField('showInHeader', checked)}
                        helpText="Display customer points in the site header"
                      />
                      <Checkbox
                        label="Show on product pages"
                        checked={state.showOnProductPage}
                        onChange={(checked) => updateField('showOnProductPage', checked)}
                        helpText="Show points earned for each product"
                      />
                      <Checkbox
                        label="Show in cart"
                        checked={state.showInCart}
                        onChange={(checked) => updateField('showInCart', checked)}
                        helpText="Display points summary in cart"
                      />
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>

            {/* Preview Section */}
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
                      <Box paddingBlockEnd="400">
                        <Text variant="bodyMd" fontWeight="semibold" as="p">
                          How it will look on your store:
                        </Text>
                      </Box>

                      {/* Header Preview */}
                      {state.showInHeader && (
                        <div style={{ marginBottom: '16px' }}>
                          <Box paddingBlockEnd="200">
                            <Text variant="bodySm" tone="subdued" as="p">
                              Header display:
                            </Text>
                          </Box>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: state.pointsDisplayStyle === 'badge' ? '2px 6px' : '8px 12px',
                            background: `${state.primaryColor}20`,
                            borderRadius: state.pointsDisplayStyle === 'badge' ? '12px' : '8px',
                            fontSize: state.pointsDisplayStyle === 'minimal' ? '12px' : '14px',
                            fontWeight: '600',
                            color: state.secondaryColor,
                          }}>
                            {state.pointsDisplayStyle !== 'minimal' && (
                              <span style={{ color: state.primaryColor, fontSize: '16px' }}>★</span>
                            )}
                            <span>1,250</span>
                            {state.pointsDisplayStyle === 'widget' && (
                              <span style={{ fontSize: '12px' }}>{state.currency}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Product Page Preview */}
                      {state.showOnProductPage && (
                        <div style={{ marginBottom: '16px' }}>
                          <Box paddingBlockEnd="200">
                            <Text variant="bodySm" tone="subdued" as="p">
                              Product page display:
                            </Text>
                          </Box>
                          <div style={{
                            padding: '8px 12px',
                            background: `${state.primaryColor}15`,
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: state.secondaryColor,
                          }}>
                            Earn {state.pointsPerDollar * 25} {state.currency} with this $25 purchase
                          </div>
                        </div>
                      )}

                      {/* Cart Preview */}
                      {state.showInCart && (
                        <div>
                          <Box paddingBlockEnd="200">
                            <Text variant="bodySm" tone="subdued" as="p">
                              Cart display:
                            </Text>
                          </Box>
                          <div style={{
                            padding: '12px',
                            background: `${state.primaryColor}10`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: state.secondaryColor,
                          }}>
                            🎉 You'll earn 125 {state.currency} with this order!
                          </div>
                        </div>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Card>
            </Box>
          </Box>
        );

      case 5:
        return (
          <Box>
            <Banner title="Install loyalty program into your theme" tone="info">
              <p>We'll automatically add the loyalty program blocks to your selected theme. Your existing design will remain unchanged.</p>
            </Banner>

            <Box paddingBlockStart="500">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Select Theme
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <Select
                        label="Theme to install loyalty program"
                        options={[
                          { label: 'Select a theme...', value: '' },
                          ...availableThemes.map(theme => ({
                            label: `${theme.name}${theme.role === 'main' ? ' (Live Theme)' : ''}`,
                            value: theme.id
                          }))
                        ]}
                        value={state.selectedTheme}
                        onChange={(value) => updateField('selectedTheme', value)}
                        helpText="Choose which theme to install the loyalty program blocks into"
                      />
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>

            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Installation Options
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <Checkbox
                        label="Automatically install theme blocks"
                        checked={state.autoInstallBlocks}
                        onChange={(checked) => updateField('autoInstallBlocks', checked)}
                        helpText="Automatically add loyalty program blocks to product pages, header, and cart"
                      />
                      <Checkbox
                        label="Create backup before installation"
                        checked={state.backupBeforeInstall}
                        onChange={(checked) => updateField('backupBeforeInstall', checked)}
                        helpText="Create a backup copy of your theme before making changes (recommended)"
                      />
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>

            {/* Installation Status */}
            {state.selectedTheme && (
              <Box paddingBlockStart="400">
                <Card>
                  <Box padding="400">
                    <Text variant="headingMd" as="h4">
                      Installation Preview
                    </Text>
                    <Box paddingBlockStart="300">
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        {state.installationStatus === 'pending' && (
                          <div>
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                              Ready to install to {availableThemes.find(t => t.id === state.selectedTheme)?.name}
                            </Text>
                            <Box paddingBlockStart="300">
                              <Text variant="bodyMd" as="p">
                                The following will be added to your theme:
                              </Text>
                              <Box paddingBlockStart="200">
                                <ul style={{ marginLeft: '20px' }}>
                                  <li>✨ Points display in header</li>
                                  <li>🛍️ Points earning info on product pages</li>
                                  <li>🎁 Reward redemption in cart</li>
                                  <li>🎨 Styled with your brand colors</li>
                                </ul>
                              </Box>
                            </Box>
                            <Box paddingBlockStart="400">
                              <Button
                                variant="primary"
                                onClick={installThemeBlocks}
                                size="large"
                              >
                                🚀 Install Now
                              </Button>
                            </Box>
                          </div>
                        )}

                        {state.installationStatus === 'installing' && (
                          <div style={{ textAlign: 'center' }}>
                            <Text variant="bodyLg" fontWeight="semibold" as="p">
                              Installing loyalty program...
                            </Text>
                            <Box paddingBlockStart="300">
                              <div style={{
                                width: '40px',
                                height: '40px',
                                border: '3px solid #f3f3f3',
                                borderTop: '3px solid #007ace',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto'
                              }} />
                            </Box>
                            <Box paddingBlockStart="300">
                              <Text variant="bodyMd" tone="subdued" as="p">
                                Adding blocks to your theme... This may take a few moments.
                              </Text>
                            </Box>
                          </div>
                        )}

                        {state.installationStatus === 'complete' && (
                          <div style={{ textAlign: 'center' }}>
                            <Text variant="bodyLg" fontWeight="semibold" as="p" style={{ color: '#008060' }}>
                              ✅ Installation Complete!
                            </Text>
                            <Box paddingBlockStart="300">
                              <Text variant="bodyMd" as="p">
                                Your loyalty program has been successfully installed to {availableThemes.find(t => t.id === state.selectedTheme)?.name}.
                              </Text>
                            </Box>
                            {state.installationMessage && (
                              <Box paddingBlockStart="200">
                                <Text variant="bodySm" tone="subdued" as="p">
                                  {state.installationMessage}
                                </Text>
                              </Box>
                            )}
                            <Box paddingBlockStart="200">
                              <Text variant="bodyMd" tone="subdued" as="p">
                                Advancing to email configuration...
                              </Text>
                            </Box>
                          </div>
                        )}

                        {state.installationStatus === 'error' && (
                          <div style={{ textAlign: 'center' }}>
                            <Text variant="bodyLg" fontWeight="semibold" as="p" style={{ color: '#d72c0d' }}>
                              ❌ Installation Failed
                            </Text>
                            <Box paddingBlockStart="300">
                              <Text variant="bodyMd" as="p">
                                There was an issue installing the loyalty program blocks.
                              </Text>
                            </Box>
                            {state.installationMessage && (
                              <Box paddingBlockStart="200">
                                <Text variant="bodySm" tone="critical" as="p">
                                  {state.installationMessage}
                                </Text>
                              </Box>
                            )}
                            <Box paddingBlockStart="400">
                              <Button
                                variant="primary"
                                onClick={installThemeBlocks}
                              >
                                Try Again
                              </Button>
                            </Box>
                          </div>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Card>
              </Box>
            )}
          </Box>
        );

      case 6:
        return (
          <Box>
            <Banner title="Configure email notifications" tone="info">
              <p>Set up automated emails to engage customers throughout their loyalty journey.</p>
            </Banner>

            <Box paddingBlockStart="500">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Email Settings
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <FormLayout.Group condensed>
                        <TextField
                          label="Sender Name"
                          value={state.emailFromName}
                          onChange={(value) => updateField('emailFromName', value)}
                          placeholder="e.g., My Store Rewards"
                          helpText="Name that appears in the 'From' field"
                          autoComplete="off"
                        />
                        <TextField
                          label="Sender Email"
                          type="email"
                          value={state.emailFromAddress}
                          onChange={(value) => updateField('emailFromAddress', value)}
                          placeholder="e.g., rewards@mystore.com"
                          helpText="Email address for sending notifications"
                          autoComplete="off"
                        />
                      </FormLayout.Group>
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>

            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Notification Types
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <Checkbox
                        label="Welcome Email"
                        checked={state.enableWelcomeEmail}
                        onChange={(checked) => updateField('enableWelcomeEmail', checked)}
                        helpText="Send a welcome email when customers join the loyalty program"
                      />
                      <Checkbox
                        label="Points Earned Email"
                        checked={state.enablePointsEarnedEmail}
                        onChange={(checked) => updateField('enablePointsEarnedEmail', checked)}
                        helpText="Notify customers when they earn points from purchases"
                      />
                      <Checkbox
                        label="Reward Available Email"
                        checked={state.enableRewardAvailableEmail}
                        onChange={(checked) => updateField('enableRewardAvailableEmail', checked)}
                        helpText="Alert customers when they have enough points for rewards"
                      />
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>

            {/* Email Preview */}
            {state.emailFromName && state.emailFromAddress && (
              <Box paddingBlockStart="400">
                <Card>
                  <Box padding="400">
                    <Text variant="headingMd" as="h4">
                      Email Preview
                    </Text>
                    <Box paddingBlockStart="300">
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Text variant="bodyMd" fontWeight="semibold" as="p">
                          Sample Email: Welcome to {state.programName}!
                        </Text>
                        <Box paddingBlockStart="200">
                          <Text variant="bodySm" tone="subdued" as="p">
                            From: {state.emailFromName} &lt;{state.emailFromAddress}&gt;
                          </Text>
                        </Box>
                        <Box paddingBlockStart="300">
                          <div style={{
                            padding: '16px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <Text variant="bodyMd" as="p">
                              Welcome to {state.programName}! 🎉
                            </Text>
                            <Box paddingBlockStart="200">
                              <Text variant="bodyMd" as="p">
                                Start earning {state.currency} with every purchase.
                                You'll get {state.signupBonus} {state.currency} just for joining!
                              </Text>
                            </Box>
                            <Box paddingBlockStart="200">
                              <Text variant="bodyMd" as="p">
                                Happy shopping!<br />
                                The {state.emailFromName} Team
                              </Text>
                            </Box>
                          </div>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Card>
              </Box>
            )}

            {/* Enabled Notifications Summary */}
            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h4">
                    Active Notifications
                  </Text>
                  <Box paddingBlockStart="300">
                    <Box
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        Customers will receive:
                      </Text>
                      <Box paddingBlockStart="200">
                        <ul style={{ marginLeft: '20px' }}>
                          {state.enableWelcomeEmail && (
                            <li>✅ Welcome email when joining the program</li>
                          )}
                          {state.enablePointsEarnedEmail && (
                            <li>✅ Notifications when earning {state.currency}</li>
                          )}
                          {state.enableRewardAvailableEmail && (
                            <li>✅ Alerts when rewards become available</li>
                          )}
                          {!state.enableWelcomeEmail && !state.enablePointsEarnedEmail && !state.enableRewardAvailableEmail && (
                            <li style={{ color: '#d72c0d' }}>❌ No email notifications enabled</li>
                          )}
                        </ul>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Card>
            </Box>
          </Box>
        );

      case 7:
        return (
          <Box>
            <Banner title="Test your loyalty program" tone="info">
              <p>Preview and test your loyalty program before launching to ensure everything works perfectly.</p>
            </Banner>

            <Box paddingBlockStart="500">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Program Summary
                  </Text>
                  <Box paddingBlockStart="400">
                    <Box
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                          <Text variant="bodyMd" fontWeight="semibold" as="p">
                            🎯 {state.programName}
                          </Text>
                          <Text variant="bodySm" tone="subdued" as="p">
                            {state.programType} • {state.currency}
                          </Text>
                        </div>

                        <div>
                          <Text variant="bodyMd" fontWeight="semibold" as="p">
                            💰 Earning Structure
                          </Text>
                          <ul style={{ marginLeft: '16px', marginTop: '4px' }}>
                            <li>{state.pointsPerDollar} {state.currency} per $1 spent</li>
                            <li>{state.signupBonus} {state.currency} signup bonus</li>
                            <li>{state.birthdayBonus} {state.currency} birthday bonus</li>
                          </ul>
                        </div>

                        <div>
                          <Text variant="bodyMd" fontWeight="semibold" as="p">
                            🎁 Rewards ({state.rewardTiers.length} tiers)
                          </Text>
                          <ul style={{ marginLeft: '16px', marginTop: '4px' }}>
                            {state.rewardTiers.slice(0, 3).map((tier, index) => (
                              <li key={tier.id}>
                                {tier.name} - {tier.pointsRequired} {state.currency}
                              </li>
                            ))}
                            {state.rewardTiers.length > 3 && (
                              <li>... and {state.rewardTiers.length - 3} more</li>
                            )}
                          </ul>
                        </div>

                        <div>
                          <Text variant="bodyMd" fontWeight="semibold" as="p">
                            🎨 Styling
                          </Text>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              background: state.primaryColor,
                              borderRadius: '50%',
                              border: '1px solid #ccc'
                            }} />
                            <Text variant="bodySm" as="span">
                              {state.pointsDisplayStyle} style • Header: {state.showInHeader ? 'Yes' : 'No'}
                            </Text>
                          </div>
                        </div>
                      </div>
                    </Box>
                  </Box>
                </Box>
              </Card>
            </Box>

            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Live Preview
                  </Text>
                  <Box paddingBlockStart="400">
                    <Box
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        Customer Journey Simulation
                      </Text>
                      <Box paddingBlockStart="300">
                        <div style={{ display: 'grid', gap: '12px' }}>
                          <div style={{
                            padding: '12px',
                            background: 'white',
                            borderRadius: '6px',
                            border: `2px solid ${state.primaryColor}20`
                          }}>
                            <Text variant="bodySm" fontWeight="semibold" as="p">
                              1. Customer Signs Up
                            </Text>
                            <Text variant="bodySm" as="p">
                              Receives {state.signupBonus} {state.currency} welcome bonus
                            </Text>
                          </div>

                          <div style={{
                            padding: '12px',
                            background: 'white',
                            borderRadius: '6px',
                            border: `2px solid ${state.primaryColor}20`
                          }}>
                            <Text variant="bodySm" fontWeight="semibold" as="p">
                              2. Makes $50 Purchase
                            </Text>
                            <Text variant="bodySm" as="p">
                              Earns {state.pointsPerDollar * 50} {state.currency} •
                              Total: {state.signupBonus + (state.pointsPerDollar * 50)} {state.currency}
                            </Text>
                          </div>

                          <div style={{
                            padding: '12px',
                            background: 'white',
                            borderRadius: '6px',
                            border: `2px solid ${state.primaryColor}20`
                          }}>
                            <Text variant="bodySm" fontWeight="semibold" as="p">
                              3. Redeems Reward
                            </Text>
                            <Text variant="bodySm" as="p">
                              {state.rewardTiers.find(t => t.pointsRequired <= (state.signupBonus + (state.pointsPerDollar * 50)))?.name || 'Can redeem available rewards'}
                            </Text>
                          </div>
                        </div>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Card>
            </Box>

            <Box paddingBlockStart="400">
              <Card>
                <Box padding="400">
                  <Text variant="headingMd" as="h3">
                    Pre-Launch Checklist
                  </Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <div style={{
                        padding: '16px',
                        background: '#f0f9ff',
                        borderRadius: '8px',
                        border: '1px solid #0ea5e9'
                      }}>
                        <Text variant="bodyMd" fontWeight="semibold" as="p">
                          ✅ Ready to Launch!
                        </Text>
                        <Box paddingBlockStart="200">
                          <ul style={{ marginLeft: '16px' }}>
                            <li>✅ Program configured with {state.rewardTiers.length} reward tiers</li>
                            <li>✅ Theme integration ready for {availableThemes.find(t => t.id === state.selectedTheme)?.name || 'selected theme'}</li>
                            <li>✅ Email notifications configured</li>
                            <li>✅ Visual styling matches your brand</li>
                          </ul>
                        </Box>
                      </div>
                    </FormLayout>
                  </Box>
                </Box>
              </Card>
            </Box>
          </Box>
        );

      case 8:
        return (
          <Box>
            {!state.programLaunched ? (
              <Banner title="🎯 Ready to launch your loyalty program!" tone="info">
                <p>Your loyalty program is fully configured and ready to go live. Click "Launch Program" to make it available to your customers.</p>
              </Banner>
            ) : (
              <Banner title="🎉 Congratulations! Your loyalty program is live!" tone="success">
                <p>Your loyalty program has been successfully launched and is now active for your customers.</p>
              </Banner>
            )}

            <Box paddingBlockStart="500">
              <Card>
                <Box padding="400">
                  <div style={{ textAlign: 'center' }}>
                    <Text variant="headingLg" as="h2">
                      {!state.programLaunched ? '🎯 Ready to Launch!' : '🚀 Launch Complete!'}
                    </Text>
                    <Box paddingBlockStart="400">
                      <Text variant="bodyLg" as="p">
                        {!state.programLaunched ? (
                          <>Your <strong>{state.programName}</strong> loyalty program is configured and ready to launch.</>
                        ) : (
                          <>Your <strong>{state.programName}</strong> loyalty program is now live and ready to start building customer relationships.</>
                        )}
                      </Text>
                    </Box>
                  </div>
                </Box>
              </Card>
            </Box>

            {state.programLaunched && (
              <>
                <Box paddingBlockStart="400">
                  <Card>
                    <Box padding="400">
                      <Text variant="headingMd" as="h3">
                        What's Next?
                      </Text>
                      <Box paddingBlockStart="400">
                        <div style={{ display: 'grid', gap: '16px' }}>
                          <div style={{
                            padding: '16px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                              📊 Monitor Performance
                            </Text>
                            <Text variant="bodyMd" as="p">
                              Track customer engagement, point redemptions, and program ROI in your dashboard.
                            </Text>
                          </div>

                          <div style={{
                            padding: '16px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                              📧 Customer Communication
                            </Text>
                            <Text variant="bodyMd" as="p">
                              Promote your new loyalty program through email newsletters and social media.
                            </Text>
                          </div>

                          <div style={{
                            padding: '16px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                              🔧 Customize Further
                            </Text>
                            <Text variant="bodyMd" as="p">
                              Fine-tune rewards, adjust earning rates, and experiment with seasonal promotions.
                            </Text>
                          </div>
                        </div>
                      </Box>
                    </Box>
                  </Card>
                </Box>

                <Box paddingBlockStart="400">
                  <Card>
                    <Box padding="400">
                      <Text variant="headingMd" as="h3">
                        Quick Stats
                      </Text>
                      <Box paddingBlockStart="400">
                        <Box
                          padding="400"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', textAlign: 'center' }}>
                            <div>
                              <Text variant="headingMd" as="p">
                                {state.rewardTiers.length}
                              </Text>
                              <Text variant="bodySm" tone="subdued" as="p">
                                Reward Tiers
                              </Text>
                            </div>
                            <div>
                              <Text variant="headingMd" as="p">
                                {state.signupBonus}
                              </Text>
                              <Text variant="bodySm" tone="subdued" as="p">
                                Welcome Bonus
                              </Text>
                            </div>
                            <div>
                              <Text variant="headingMd" as="p">
                                {state.pointsPerDollar}x
                              </Text>
                              <Text variant="bodySm" tone="subdued" as="p">
                                Earning Rate
                              </Text>
                            </div>
                            <div>
                              <Text variant="headingMd" as="p">
                                {[state.enableWelcomeEmail, state.enablePointsEarnedEmail, state.enableRewardAvailableEmail].filter(Boolean).length}
                              </Text>
                              <Text variant="bodySm" tone="subdued" as="p">
                                Email Types
                              </Text>
                            </div>
                          </div>
                        </Box>
                      </Box>
                    </Box>
                  </Card>
                </Box>
              </>
            )}
          </Box>
        );

      default:
        return (
          <Card>
            <Box padding="600">
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
              <Box paddingBlockStart="400" padding="600" background="bg-surface-secondary" borderRadius="300">
                <Text variant="bodyMd" as="p">
                  🚧 Phase 2A will implement: Reward Tiers, Visual Customization
                  <br />
                  🚧 Phase 2B will implement: Theme Integration, Email Setup, Testing, and Launch
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
                    {`${Math.round(progress)}% Complete`}
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
                      {isLastStep ? (
                        !state.programLaunched ? (
                          <Button
                            variant="primary"
                            onClick={launchProgram}
                            disabled={errors.length > 0}
                          >
                            🚀 Launch Program
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => navigate(`/app${location.search || ""}`)}
                          >
                            🎯 Go to Dashboard
                          </Button>
                        )
                      ) : (
                        <Button
                          variant="primary"
                          onClick={nextStep}
                          disabled={errors.length > 0}
                        >
                          Continue
                        </Button>
                      )}
                    </ButtonGroup>
                  </Box>
                </div>
                <Box paddingBlockStart="300">
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
