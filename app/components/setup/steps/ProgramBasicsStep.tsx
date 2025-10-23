/**
 * Program Basics Step Component
 *
 * First step of the setup wizard - collecting basic program information
 */

import React, { useState, useCallback } from 'react';
import {
  FormLayout,
  TextField,
  Select,
  Card,
  Stack,
  Text,
  Box,
  Icon,
  Banner,
  Tooltip,
} from '@shopify/polaris';
import { QuestionCircleIcon } from '@shopify/polaris-icons';
import { useSetup } from '../../../contexts/SetupContext';
import { ProgramBasics } from '../../../types/setup';

const CURRENCY_OPTIONS = [
  { label: 'Points', value: 'points' },
  { label: 'Coins', value: 'coins' },
  { label: 'Stars', value: 'stars' },
  { label: 'Credits', value: 'credits' },
];

const PROGRAM_TYPE_OPTIONS = [
  {
    label: 'Points-based',
    value: 'points-based',
    description: 'Customers earn points for purchases and activities',
  },
  {
    label: 'Tier-based',
    value: 'tier-based',
    description: 'Customers unlock tiers with increasing benefits',
  },
  {
    label: 'Cashback',
    value: 'cashback',
    description: 'Customers earn money back on purchases',
  },
];

export function ProgramBasicsStep() {
  const { data, updateData } = useSetup();
  const { programBasics } = data;

  const [localData, setLocalData] = useState<ProgramBasics>(programBasics);

  const handleChange = useCallback((field: keyof ProgramBasics, value: any) => {
    const updatedData = { ...localData, [field]: value };
    setLocalData(updatedData);
    updateData({ programBasics: updatedData });
  }, [localData, updateData]);

  const selectedProgramType = PROGRAM_TYPE_OPTIONS.find(
    option => option.value === localData.programType
  );

  return (
    <Stack vertical spacing="loose">
      {/* Welcome Banner */}
      <Banner title="Let's set up your loyalty program!" tone="info">
        <p>
          We'll help you create a loyalty program that engages customers and drives repeat purchases.
          This should only take about 15 minutes to complete.
        </p>
      </Banner>

      {/* Program Information Form */}
      <Card>
        <Box padding="500">
          <Stack vertical spacing="loose">
            <Text variant="headingMd" as="h3">
              Program Information
            </Text>

            <FormLayout>
              {/* Program Name */}
              <FormLayout.Group>
                <TextField
                  label={
                    <Stack spacing="extraTight" alignment="center">
                      <Text as="span">Program Name</Text>
                      <Tooltip content="This is what customers will see when referring to your loyalty program">
                        <Icon source={QuestionCircleIcon} tone="subdued" />
                      </Tooltip>
                    </Stack>
                  }
                  value={localData.programName}
                  onChange={(value) => handleChange('programName', value)}
                  placeholder="e.g., My Store Rewards, VIP Club, Points Program"
                  helpText="Choose a memorable name that reflects your brand"
                  maxLength={50}
                  showCharacterCount
                  autoComplete="off"
                />
              </FormLayout.Group>

              {/* Currency Type */}
              <FormLayout.Group condensed>
                <Select
                  label={
                    <Stack spacing="extraTight" alignment="center">
                      <Text as="span">Points Currency</Text>
                      <Tooltip content="What will you call the points customers earn? This appears throughout your store.">
                        <Icon source={QuestionCircleIcon} tone="subdued" />
                      </Tooltip>
                    </Stack>
                  }
                  options={CURRENCY_OPTIONS}
                  value={localData.currency}
                  onChange={(value) => handleChange('currency', value)}
                />

                {/* Program Type */}
                <Select
                  label={
                    <Stack spacing="extraTight" alignment="center">
                      <Text as="span">Program Type</Text>
                      <Tooltip content="Choose the type of loyalty program that best fits your business model">
                        <Icon source={QuestionCircleIcon} tone="subdued" />
                      </Tooltip>
                    </Stack>
                  }
                  options={PROGRAM_TYPE_OPTIONS.map(option => ({
                    label: option.label,
                    value: option.value,
                  }))}
                  value={localData.programType}
                  onChange={(value) => handleChange('programType', value)}
                />
              </FormLayout.Group>
            </FormLayout>
          </Stack>
        </Box>
      </Card>

      {/* Program Type Description */}
      {selectedProgramType && (
        <Card>
          <Box padding="400">
            <Stack vertical spacing="tight">
              <Text variant="headingMd" as="h4">
                {selectedProgramType.label} Program
              </Text>
              <Text variant="bodyMd" as="p">
                {selectedProgramType.description}
              </Text>

              {/* Program Type Benefits */}
              <Box paddingBlockStart="300">
                {localData.programType === 'points-based' && (
                  <Stack vertical spacing="extraTight">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      Perfect for:
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Encouraging repeat purchases
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Rewarding customer activities (reviews, referrals)
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Building long-term customer relationships
                    </Text>
                  </Stack>
                )}

                {localData.programType === 'tier-based' && (
                  <Stack vertical spacing="extraTight">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      Perfect for:
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Creating VIP experiences
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Encouraging higher order values
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Exclusive product access and perks
                    </Text>
                  </Stack>
                )}

                {localData.programType === 'cashback' && (
                  <Stack vertical spacing="extraTight">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      Perfect for:
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Direct monetary incentives
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Competitive market positioning
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Immediate customer gratification
                    </Text>
                  </Stack>
                )}
              </Box>
            </Stack>
          </Box>
        </Card>
      )}

      {/* Preview Section */}
      {localData.programName && (
        <Card>
          <Box padding="400">
            <Stack vertical spacing="tight">
              <Text variant="headingMd" as="h4">
                Preview
              </Text>
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
                borderColor="border"
                borderWidth="025"
              >
                <Stack spacing="tight" alignment="center">
                  <Text variant="bodyLg" fontWeight="semibold" as="p">
                    Welcome to {localData.programName}!
                  </Text>
                  <Text variant="bodyMd" tone="subdued" as="p">
                    Start earning {localData.currency} with every purchase and activity.
                  </Text>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Card>
      )}
    </Stack>
  );
}