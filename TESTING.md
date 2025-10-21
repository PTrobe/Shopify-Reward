# Loyco Loyalty System - Testing Guide

## 🧪 Comprehensive Testing Strategy

This guide covers all testing aspects of the Loyco Loyalty system, from unit tests to end-to-end integration testing.

## Testing Environment Setup

### Prerequisites

- Development store with loyalty app installed
- Test customer accounts
- Sample products and orders
- Postman or curl for API testing
- Browser dev tools for extension testing

### Test Data Setup

```bash
# Create test database
npm run db:reset
npm run db:seed

# Start development server
npm run dev

# In another terminal, start extension development
shopify app dev
```

## Backend API Testing

### 1. Authentication Testing

```bash
# Test OAuth flow
curl -X GET "http://localhost:3000/auth?shop=test-store.myshopify.com"

# Test session validation
curl -X GET "http://localhost:3000/api/admin/customers" \
  -H "Authorization: Bearer valid_session_token"
```

### 2. Customer Management

```bash
# Test customer enrollment
curl -X POST "http://localhost:3000/apps/loyco-rewards/api/customer/enroll" \
  -H "Content-Type: application/json" \
  -d '{
    "shopifyCustomerId": "12345",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "Customer"
  }'

# Test customer status retrieval
curl -X GET "http://localhost:3000/apps/loyco-rewards/api/customer/12345/status?shop=test-store.myshopify.com"
```

### 3. Points Management

```bash
# Test points earning
curl -X POST "http://localhost:3000/apps/loyco-rewards/api/customer/12345/earn" \
  -H "Content-Type: application/json" \
  -d '{
    "points": 100,
    "activityType": "PURCHASE",
    "description": "Test order #1001",
    "orderId": "order_123"
  }'

# Test reward redemption
curl -X POST "http://localhost:3000/apps/loyco-rewards/api/customer/12345/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "rewardId": "reward_456",
    "quantity": 1
  }'
```

### 4. Admin API Testing

```bash
# Test customer listing
curl -X GET "http://localhost:3000/api/admin/customers?page=1&limit=10" \
  -H "Authorization: Bearer admin_token"

# Test loyalty program configuration
curl -X PUT "http://localhost:3000/api/admin/program" \
  -H "Content-Type: application/json" \
  -d '{
    "pointsPerDollar": 1,
    "welcomeBonus": 100,
    "referralBonus": 50
  }'
```

## Theme App Extensions Testing

### 1. Customer Status Block

**Test Cases:**
- [ ] Displays loading state initially
- [ ] Shows enrollment prompt for guests
- [ ] Displays points balance for members
- [ ] Shows current tier and progress
- [ ] Updates in real-time
- [ ] Handles API errors gracefully

**Testing Steps:**
1. Add block to theme
2. View as guest - should show enrollment prompt
3. Log in as customer - should show loyalty status
4. Modify points in admin - should update automatically
5. Test on mobile devices

### 2. Product Points Indicator

**Test Cases:**
- [ ] Calculates correct base points
- [ ] Shows tier bonus for VIP customers
- [ ] Updates when product variant changes
- [ ] Positions correctly based on settings
- [ ] Handles products without prices

**Testing Steps:**
1. Add to product page template
2. View different products with various prices
3. Test as different tier customers
4. Verify positioning options work
5. Test variant switching

### 3. Rewards Grid

**Test Cases:**
- [ ] Displays available rewards
- [ ] Shows affordability status
- [ ] Handles reward redemption
- [ ] Shows success/error messages
- [ ] Filters based on customer points
- [ ] Modal functionality works

**Testing Steps:**
1. Add to page with sufficient spacing
2. Test with customer having various point balances
3. Attempt reward redemption
4. Verify modal opens/closes properly
5. Test responsive behavior

### 4. Header Widget

**Test Cases:**
- [ ] Dropdown toggles correctly
- [ ] Shows condensed loyalty info
- [ ] Quick rewards display
- [ ] Mobile responsive design
- [ ] Closes when clicking outside

**Testing Steps:**
1. Add to header template
2. Test dropdown functionality
3. Verify mobile menu integration
4. Test with long customer names/tier names
5. Verify z-index layering

### 5. Cart Summary

**Test Cases:**
- [ ] Calculates order points correctly
- [ ] Shows tier upgrade notifications
- [ ] Displays referral code
- [ ] Updates when cart changes
- [ ] Handles empty cart

**Testing Steps:**
1. Add to cart page
2. Add/remove items from cart
3. Test with customers at tier boundaries
4. Verify cart total calculations
5. Test referral code copying

## UI Extensions Testing

### 1. Checkout Extension

**Test Cases:**
- [ ] Shows for logged-in customers
- [ ] Displays enrollment prompt for guests
- [ ] Calculates correct points for order
- [ ] Shows tier upgrade notifications
- [ ] Displays available rewards
- [ ] Handles order modifications

**Testing Steps:**
1. Install checkout extension
2. Create test orders as guest and customer
3. Modify order (add/remove items)
4. Test with different tier customers
5. Verify mobile checkout experience

### 2. Customer Account Extension

**Test Cases:**
- [ ] Displays loyalty dashboard
- [ ] Shows tier progress
- [ ] Lists available rewards
- [ ] Shows transaction history
- [ ] Displays referral code
- [ ] Handles data loading errors

**Testing Steps:**
1. Install customer account extension
2. Log in as test customer
3. Navigate through account sections
4. Test with customers at different tiers
5. Verify data accuracy

## Integration Testing

### 1. Webhook Processing

**Test Scenarios:**
- Order created → Points awarded
- Order updated → Points adjusted
- Order cancelled → Points reversed
- Customer created → Welcome bonus
- Customer updated → Profile sync
- App uninstalled → Data cleanup

**Testing:**
```bash
# Simulate webhook events
curl -X POST "http://localhost:3000/webhooks" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/create" \
  -d @test-order.json
```

### 2. Real-time Updates

**Test Flow:**
1. Customer earns points via purchase
2. Verify all extensions update automatically
3. Customer redeems reward
4. Verify point balance updates everywhere
5. Tier upgrade occurs
6. Verify tier status updates across all touchpoints

## Performance Testing

### 1. API Response Times

```bash
# Test API performance
for i in {1..100}; do
  curl -w "%{time_total}\n" -s -o /dev/null \
    "http://localhost:3000/apps/loyco-rewards/api/customer/12345/status"
done | awk '{sum+=$1} END {print "Average:", sum/NR}'
```

### 2. Extension Load Times

**Metrics to Monitor:**
- Initial page load impact
- Time to first contentful paint
- API response times
- Cache hit rates
- Database query performance

### 3. Concurrent Users

**Load Testing:**
- Use tools like Artillery or k6
- Test 100+ concurrent users
- Monitor database connections
- Check Redis performance
- Verify rate limiting

## Security Testing

### 1. Authentication

**Test Cases:**
- [ ] Invalid session tokens rejected
- [ ] Expired sessions handled
- [ ] Shop domain validation
- [ ] OAuth flow security

### 2. App Proxy Security

**Test Cases:**
- [ ] Signature validation
- [ ] Timestamp validation
- [ ] Shop parameter validation
- [ ] Rate limiting effective

### 3. Input Validation

**Test Cases:**
- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized
- [ ] Invalid data types rejected
- [ ] Required fields enforced

### 4. Data Privacy

**Test Cases:**
- [ ] Customer data access restricted
- [ ] Sensitive data encrypted
- [ ] Logs don't contain secrets
- [ ] Data export/deletion works

## Error Handling Testing

### 1. Network Failures

**Scenarios:**
- Database connection lost
- Redis unavailable
- External API timeouts
- Shopify API rate limits

### 2. Invalid Data

**Test Cases:**
- Malformed JSON requests
- Missing required fields
- Invalid customer IDs
- Non-existent rewards

### 3. Edge Cases

**Scenarios:**
- Customer with 0 points
- Rewards with 0 cost
- Orders with 0 value
- Customers without tiers

## Browser Compatibility

### Desktop Testing
- [ ] Chrome (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Edge (latest 2 versions)

### Mobile Testing
- [ ] iOS Safari
- [ ] Chrome Mobile
- [ ] Samsung Internet
- [ ] Firefox Mobile

## Accessibility Testing

### WCAG Compliance
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast sufficient
- [ ] Focus indicators visible
- [ ] Alternative text provided

### Testing Tools
- axe-core browser extension
- WAVE Web Accessibility Evaluator
- Lighthouse accessibility audit
- VoiceOver/NVDA testing

## Test Automation

### Unit Tests
```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test
      - run: npm run test:integration
```

## Test Data Management

### Sample Data

```javascript
// test-data.js
export const sampleCustomer = {
  shopifyCustomerId: "12345",
  email: "test@example.com",
  firstName: "Test",
  lastName: "Customer",
  pointsBalance: 500,
  lifetimePoints: 1200
};

export const sampleOrder = {
  id: "order_123",
  total_price: 10000, // $100.00 in cents
  customer: sampleCustomer
};
```

### Database Seeding

```bash
# Seed test data
npm run db:seed:test

# Reset test database
npm run db:reset:test
```

## Monitoring & Debugging

### Logging
- API request/response logging
- Error tracking with stack traces
- Performance metrics logging
- User interaction tracking

### Debug Tools
- Browser developer tools
- Shopify app debugging
- Database query analysis
- Redis monitoring

## Test Reporting

### Coverage Reports
- Line coverage > 80%
- Branch coverage > 75%
- Function coverage > 90%

### Performance Benchmarks
- API responses < 200ms
- Page load impact < 100ms
- Extension rendering < 50ms

### Bug Tracking
- Issue categorization
- Severity levels
- Resolution tracking
- Regression testing

---

## 🎯 Testing Checklist

Before each release:

- [ ] All unit tests passing
- [ ] Integration tests complete
- [ ] Manual testing performed
- [ ] Performance benchmarks met
- [ ] Security tests passed
- [ ] Accessibility verified
- [ ] Cross-browser testing done
- [ ] Mobile testing complete
- [ ] Error handling verified
- [ ] Documentation updated

This comprehensive testing strategy ensures the Loyco Loyalty system is robust, secure, and provides an excellent user experience across all touchpoints.