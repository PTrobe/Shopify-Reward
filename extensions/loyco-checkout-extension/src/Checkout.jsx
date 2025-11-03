import {
  reactExtension,
  Banner,
  Text,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => <LoyaltyCheckoutExtension />);

function LoyaltyCheckoutExtension() {
  return (
    <Banner status="critical">
      <Text>🚨 LOYCO CHECKOUT EXTENSION TEST - If you see this, the extension is working!</Text>
    </Banner>
  );
}
