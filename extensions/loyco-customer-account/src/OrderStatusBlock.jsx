import {
  reactExtension,
  Banner,
  Text,
  BlockStack,
} from '@shopify/ui-extensions-react/customer-account';

export default reactExtension('customer-account.order-status.block.render', () => <OrderStatusExtension />);

function OrderStatusExtension() {
  console.log('🚨 LOYCO ORDER STATUS BLOCK: Extension function called');

  return (
    <BlockStack spacing="base">
      <Banner status="critical">
        <Text>🚨 LOYCO ORDER STATUS BLOCK TEST - Order status block working!</Text>
      </Banner>
      <Text size="base">Loyco Rewards - Order Status Block Test</Text>
    </BlockStack>
  );
}