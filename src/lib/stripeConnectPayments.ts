export type StripeConnectPaymentState = {
  connected: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

export type PaymentModeDefault = 'online' | 'in_person' | 'client_choice'

export function isStripeConnectReady(state: StripeConnectPaymentState) {
  return state.connected && state.chargesEnabled && state.payoutsEnabled
}

export function shouldRequireOnlinePaymentReactivation(
  previousReady: boolean,
  currentReady: boolean,
) {
  return previousReady && !currentReady
}

export function getEffectivePaymentMode(
  preferredMode: PaymentModeDefault,
  stripeReady: boolean,
  reactivationRequired: boolean,
): PaymentModeDefault {
  if (preferredMode === 'in_person') return 'in_person'
  return stripeReady && !reactivationRequired ? preferredMode : 'in_person'
}
