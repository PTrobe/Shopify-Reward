import {
  reactExtension,
  Banner,
  Text,
} from '@shopify/ui-extensions-react/customer-account';

export default reactExtension('customer-account.page.render', () => <LoyaltyPage />);

function LoyaltyPage() {
  return (
    <Banner status="critical">
      <Text>🚨 LOYCO CUSTOMER ACCOUNT EXTENSION TEST - If you see this, the extension is working!</Text>
    </Banner>
  );
}
