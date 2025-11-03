import {
  reactExtension,
  Banner,
  Text,
} from '@shopify/ui-extensions-react/customer-account';

export default reactExtension('customer-account.order-status.block.render', () => <OrderStatusExtension />);

function OrderStatusExtension() {
  return (
    <Banner title="✅ Loyco order status extension loaded">
      <Text>
        Earn points on your order!
      </Text>
    </Banner>
  );
}