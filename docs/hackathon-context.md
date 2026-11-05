​Velo x Noir Agentic Payment Hackathon
Build AI agents that can pay, get paid and settle on Stellar.

​AI agents can already research, book and negotiate. What they can't do yet is handle money: hold a wallet, ask to be paid, pay for what they need, and prove the payment settled.

​The Velo x Noir Agentic Payment Hackathon is about building that on Stellar. Every project must be an agentic payment that uses both Velo and Noir: built with Velo, the payments and operations layer for Stellar, and interacting with the latest Noir Testnet contracts. The top 10 teams pitch face-to-face for a share of the 10K prize pool.

​🧠 Theme: Building agentic payments

​💰 Prize pool: 10K
🥇 1st: 5,000 · 🥈 2nd: 3,000 · 🥉 3rd: 2,000

​📅 Schedule
Thursday, Nov 5: Kickoff and build
Sunday, Nov 8:

​8:00 AM: Submissions close

​11:00 AM: Top 10 announced

​1:00 PM: Face-to-face pitching and awarding

​🛠 Build requirements

​An agentic payment: the agent decides, requests or makes the payment

​Built with Velo: npm install @carts1024/velo-sdk

​Sign up here and register your project: https://velo-build.dev

​Interacts with the latest Noir Testnet contracts (device_registry, agent_registry, payment_escrow)

​Velo: 
Velo-Ecosystem-Collection/Velo

​Noir: 
noirx402/noir

​👥 Who can join: Students, developers, designers and founders, either solo or in teams of 2 to 4.

​✅ Register here (required): 
Open Google Form

​Your Luma RSVP alone doesn't count. Every participant also fills out the form and uploads screenshots showing that they:

​Starred the Velo GitHub repo

​Starred the Noir x402 GitHub repo

​Followed Velo and Noir on X

​Followed our community partners on X: @highrable, @GigPayPH, @VertigralTech

​⏰ Registration closes Wednesday, Nov 4, 11:59 PM (Manila time).

​Hosted by Velo x Noir · Community partners Highrable, GigPay, TyFi

​#VeloxNoir #AgenticPayment #AgenticPayments #BuildOnStellar #Stellar #Velo #NoirWallet #x402 #AIAgents #Web3PH #HackathonPH



What is noir? 

# Noir Wallet --- Repository Analysis

> Repository: https://github.com/noirx402/noir\
> Scope: This analysis is based only on files and documentation in the
> Noir repository. It does not use external articles, websites, or
> independent claims about the project.

## 1. What is Noir?

Noir Wallet is a contactless payment wallet prototype built around
NFC/RFID devices, the x402 payment flow, the Stellar blockchain, and
Soroban smart contracts.

Its central idea is to let someone initiate a payment by tapping a
linked NFC tag, card, sticker, or wearable at a terminal. The intended
experience removes the need to open the wallet app, unlock the phone, or
manually approve every payment.

A physical device is associated with a Stellar wallet and a
device-specific payment agent. The agent receives limited authority
under a spending policy, while Soroban contracts enforce device
registration, agent authorization, escrow accounting, and merchant
settlement.

**Important maturity note:** The repository describes Noir as alpha
software. The main demonstrated flow is on Stellar Testnet. The README
says the x402 tap-to-pay flow, escrow settlement, and constrained agent
authorization have been implemented, but the architecture and testing
documents clarify that the mobile app's tap screens still pay directly
from per-device agent wallets. The escrow `authorize()` and merchant
`claim()` flow exists in the contracts and SDK but is not fully wired
into the app. Production settlement and the PDAX fiat bridge are not
live.

## 2. The core idea in plain language

Think of Noir as a programmable NFC payment system.

-   The NFC tag identifies a registered device.
-   The wallet owner links that device to their wallet.
-   A separate agent key is associated with the device.
-   The wallet owner defines what the agent is allowed to spend.
-   The smart contracts check those permissions.
-   In the intended escrow flow, payments are authorized against
    pre-funded funds and merchants claim accumulated payments later.

The NFC tag is **not** the wallet and does not contain the user's
private key or seed phrase. According to `docs/architecture.md`, the tag
is treated as an identifier. Its UID is read by the app, hashed with
SHA-256, and only the resulting 32-byte hash is used in on-chain state.

## 3. Main components

  -----------------------------------------------------------------------

  Component                           Role

  ----------------------------------- -----------------------------------

  NFC/RFID tag or wearable            Supplies a device UID when tapped

  React Native app / POS              Reads the UID, hashes it, handles
                                      wallet operations, signs
                                      transactions, and coordinates the
                                      flow

  Per-device agent                    Uses a device-specific signing key
                                      to request payment authorization

  `device_registry`                   Maps a device hash to its owner and
                                      associated agent

  `agent_registry`                    Stores the agent's spending policy

  `payment_escrow`                    Holds per-device escrow funds,
                                      authorizes payments, and supports
                                      merchant claims

  Stellar network                     Hosts the Soroban contracts and
                                      processes on-chain state changes
  -----------------------------------------------------------------------

### Technology stack

The README lists:

-   **Blockchain:** Stellar
-   **Smart contracts:** Soroban, written in Rust
-   **Mobile frontend:** React Native, Expo, TypeScript
-   **Styling:** NativeWind and Tailwind CSS
-   **State management:** Zustand
-   **NFC:** `react-native-nfc-manager`
-   **Wallet SDK:** `@stellar/stellar-sdk`
-   **Testing:** Vitest
-   **Contract development:** Rust nightly and `soroban-cli`

## 4. How it works

### 4.1 Device provisioning

The documented device-linking process is:

1.  The user opens Noir Wallet and selects the device-linking flow.
2.  The phone reads the NFC tag's UID.
3.  The app calculates `SHA-256(UID)`.
4.  A per-device agent keypair is created.
5.  The wallet owner signs the registration transaction.
6.  `device_registry.register()` records the device hash, wallet owner,
    and agent.
7.  The owner signs `agent_registry.register_agent()` to authorize the
    agent under a policy.
8.  The device is linked and can be used in the payment flow.

The owner authorization is important. The contracts use `require_auth()`
so registration and policy changes are not supposed to rely only on
frontend checks.

### 4.2 Agent authorization policy

The `agent_registry` contract stores an `AgentPolicy` associated with a
device. The documented policy includes:

-   Agent address
-   Maximum payment amount
-   Permitted asset
-   Expiration timestamp

The contract's `check_payment()` predicate checks that:

-   The requested agent matches the authorized agent.
-   The requested asset matches the policy asset.
-   The amount is positive.
-   The amount does not exceed the configured cap.
-   The authorization has not expired.

The repository documents two special values:

-   `max_amount = 0` means uncapped.
-   `expires_at = 0` means the policy does not expire.

### 4.3 Intended escrow payment flow

The architecture document describes this target flow:

1.  The wallet owner pre-funds escrow for a registered device.
2.  A customer taps the NFC tag at a POS terminal.
3.  The terminal reads the UID and hashes it.
4.  The agent requests authorization using a nonce.
5.  `payment_escrow.authorize()` checks the nonce, agent policy,
    permitted asset, amount, and escrow balance.
6.  If valid, the amount is deducted from the device's escrow balance
    and recorded as pending for the merchant.
7.  The merchant calls `payment_escrow.claim()` to receive accumulated
    pending payments.

This separates payment authorization from merchant settlement. Instead
of requiring a conventional payer-side wallet submission for every tap,
the intended design uses pre-funded escrow and later batch claims.

**Implementation qualification:** `docs/architecture.md` explicitly says
this is the target flow. The contracts and SDK implement and test
`authorize()` and `claim()`, but the app's tap screens still pay
straight from the per-device agent wallet. `docs/testing.md` repeats
that escrow authorization and merchant claim are not fully wired app
features.

### 4.4 Revocation and fund recovery

The owner can revoke an agent's authorization. After revocation,
`sweep_on_revoke()` can return the device's remaining escrow balance to
the owner. The contract refuses to sweep while the agent remains active.

The owner can also withdraw unused escrow funds through
`defund_escrow()`.

This is important because a payment system needs a recovery path for
lost devices, disabled agents, and unused funds.

## 5. The three Soroban contracts

### 5.1 `device_registry` --- device identity

Responsibilities:

-   Maps a 32-byte device hash to a wallet owner and agent.
-   Tracks device status and creation time.
-   Allows the owner to register or revoke a device.
-   Provides lookup and wallet-device enumeration methods.

Notable methods include:

-   `register()`
-   `revoke()`
-   `get_device()`
-   `is_authorized()`
-   `get_owner()`
-   `get_agent()`

### 5.2 `agent_registry` --- delegated spending permissions

Responsibilities:

-   Stores the agent authorized for a device.
-   Stores the spending cap, asset, and expiration.
-   Allows the owner to authorize or revoke an agent.
-   Exposes policy checks used by the escrow contract.

Notable methods include:

-   `register_agent()`
-   `revoke_agent()`
-   `get_policy()`
-   `is_auth()`
-   `check_payment()`

### 5.3 `payment_escrow` --- funds and settlement

Responsibilities:

-   Holds pre-funded balances per device.
-   Checks payment authorization against the agent policy.
-   Uses nonces to reject replayed authorization requests.
-   Records pending merchant payments.
-   Supports merchant batch claims.
-   Allows owners to defund or recover escrow funds.

Notable methods include:

-   `fund_escrow()`
-   `authorize()`
-   `claim()`
-   `defund_escrow()`
-   `sweep_on_revoke()`
-   `balance_of()`
-   `pending_balance()`

## 6. Features that stand out

### 6.1 Zero-interaction payment experience

The product's visible differentiator is the intended tap-to-pay
experience. A user taps a linked device rather than navigating through a
wallet app and approving every transaction.

Potential use cases named in the README include:

-   Transit turnstiles
-   Campus canteens
-   Event gates
-   Retail checkout

These are environments where reducing interaction time could be
valuable.

### 6.2 Per-device delegated agents

This is arguably more technically interesting than NFC itself.

Rather than giving one agent unrestricted access to the user's main
wallet, Noir associates an agent with a particular device and gives it a
policy.

For example, a user could conceptually configure:

  Device              Illustrative cap Permitted asset

  ----------------- ------------------ -----------------

  NFC card A                 500 units Asset A
  Campus wearable            100 units Asset A
  Secondary card              50 units Asset A

These values are examples only, not project defaults.

The important design is that each device can have its own agent,
spending cap, asset restriction, and expiry.

### 6.3 On-chain policy enforcement

The contracts enforce authorization rules rather than trusting the
frontend alone. The wallet owner's authorization is required for device
registration and agent policy changes.

The escrow contract calls the agent registry's payment check before
accepting a payment authorization.

### 6.4 Escrow and batch merchant settlement

The design separates the moment a payment is authorized from the moment
a merchant claims funds. This can reduce the need for a full payer-side
settlement transaction on every tap.

The idea is promising for high-throughput payment environments, although
the mobile app integration remains incomplete according to the
repository's own documentation.

### 6.5 Revocation and fund recovery

The project includes explicit operations for revoking agents, defunding
unused balances, and sweeping escrow funds after revocation. This
demonstrates attention to the device lifecycle rather than only the
happy-path payment.

### 6.6 Payment notifications

The README describes incoming payment notifications:

-   While the app is open, balances update on screen.
-   In the background, the app polls Horizon every 30 seconds.
-   When closed, an Android background task may run around every 15
    minutes or longer, depending on Android scheduling.

The repository explicitly says closed-app notifications are not
real-time. It also notes that a server watching Horizon and sending push
notifications would be needed for instant closed-app alerts; that server
is not part of the release described.

### 6.7 Mobile wallet and broader app features

The README and project structure describe a cross-platform React Native
/ Expo app with wallet, NFC provisioning, agents, activity,
send/receive, browsing, and notification functionality.

## 7. Why it stands out

Four aspects make the project notable:

1.  **Physical identity plus programmable permissions.** The NFC device
    is connected to an on-chain identity and a policy, rather than being
    only a shortcut to a conventional wallet action.
2.  **Constrained delegated authorization.** A device-specific agent can
    be given limited authority instead of unrestricted control over the
    main wallet.
3.  **Authorization separated from settlement.** The escrow architecture
    aims to authorize payments quickly and let merchants claim
    accumulated payments later.
4.  **Lifecycle and recovery considerations.** The contracts and tests
    address revocation, stale authorization, replayed requests, and
    recovery of remaining funds.

The standout idea is not simply "tap an NFC card to pay." It is the
combination of a physical payment trigger with constrained, programmable
delegation.

## 8. Limitations and risks visible in the repository

### 8.1 Escrow flow is not fully integrated into the app

This is the most important implementation gap. The architecture
describes escrow authorization and merchant batch claims as the target
payment flow, but the app's tap screens still use per-device agent
wallets. The contract and SDK functionality should not be confused with
a complete end-to-end mobile product flow.

### 8.2 NFC UIDs are clonable

The architecture explicitly treats the NFC tag as untrusted and
clonable. The tag holds no secret. Hashing the UID protects the raw
identifier from being stored on-chain, but hashing does not make a
clonable UID a strong authentication factor.

The agent policy and escrow checks constrain what can happen with a
device identifier, but the design still needs careful consideration of
cloned tags and fraudulent payment requests.

### 8.3 Merchant identity and payment integrity

The testing documentation says the policy does not hold a merchant
allow-list: any address other than the escrow contract itself is a valid
merchant. A production payment system would need a clear merchant trust
and verification model, as well as reliable integrity for the amount and
destination presented to the payment flow.

### 8.4 No third-party audit

The architecture document says the contracts have automated test
coverage but have not been audited by a third party. Passing tests are
useful engineering evidence, but they are not equivalent to an
independent security audit.

### 8.5 Testnet and production readiness

The README labels the project alpha and says production settlement is
not live. Mainnet contract deployment does not, by itself, mean the
complete payment product is operating in production.

### 8.6 Fiat bridge is not live

The README describes optional PHP cash-out through PDAX, but also says
the integration is not live. The project structure identifies the PDAX
backend as parked and not wired into the app.

### 8.7 Background notifications are delayed

Closed-app notifications depend on Android background scheduling and can
be delayed. The README says a server-side Horizon watcher and
push-notification service would be needed for real-time closed-app
alerts.

## 9. Testing and engineering signals

The repository's `docs/testing.md` contains a test summary dated October
21, 2026:

  -----------------------------------------------------------------------

  Test area                                               Reported result

  ------------------------------ ----------------------------------------

  Soroban contracts                                   60 passed, 0 failed

  App unit tests                                               306 passed

  Agent SDK                        18 passed; live suites skipped in that
                                                                  summary

  REST gateway                                                  18 passed

  App TypeScript check                                              Clean

  Live Testnet flow                                      Reported passing

  Live security matrix                    Reported PASS on the October 24
                                       redeployment, covering 20 outcomes
  -----------------------------------------------------------------------

The contract tests cover device ownership, agent permissions,
expiration, spending caps, wrong assets, nonce replay, insufficient
balances, escrow recovery, and other negative paths.

The testing document also describes CI workflows for contract, frontend,
and SDK testing.

These results are evidence of substantial testing effort. They do not
prove that the system is secure under every real-world condition, and
they do not replace a third-party audit or physical-device acceptance
testing.

## 10. My thoughts

My assessment is that Noir is more interesting as a **programmable
payment infrastructure prototype** than as another crypto wallet.

The NFC interaction is the visible feature, but the more meaningful
technical idea is the authorization model:

-   Physical devices identify payment contexts.
-   Individual agents receive delegated permissions.
-   Smart contracts enforce spending policies.
-   Escrow separates authorization from merchant settlement.
-   Revocation provides a recovery mechanism.

### What I like

-   The three-contract separation is clear and purposeful.
-   The security model considers unauthorized agents, replayed requests,
    expired permissions, cross-asset withdrawal attempts, and device
    revocation.
-   The project considers the lifecycle of a device, not just initial
    registration.
-   The repository includes tests, documentation, and deployment
    evidence.
-   The use cases are concrete: campus payments, transit, events, and
    retail.

### What concerns me

**First: the gap between the intended architecture and the app
integration.** The escrow design is one of the strongest parts of the
project, but the repository says it is not yet fully connected to the
mobile tap flow. That is a material gap between contract capability and
product capability.

**Second: NFC UID identification is not strong authentication by
itself.** The repository acknowledges that tags can be cloned. The
constrained agent and escrow model help limit authority, but a
production system needs robust protection against cloned identifiers,
replay, and fraudulent payment requests.

**Third: merchant-side trust needs more attention.** A system that
removes user confirmation must be especially careful about merchant
identity, amount integrity, duplicate requests, and dispute handling.
The documented policy does not currently include a merchant allow-list.

**Fourth: production adoption is harder than contract implementation.**
Reliable terminals, NFC hardware, network availability, fiat settlement,
compliance, support, and merchant integration are all necessary for a
real payment network.

### Overall verdict

Noir is a compelling prototype with a meaningful engineering foundation.
Its strongest idea is allowing a physical device to initiate payment
through a constrained agent without giving that agent unrestricted
control over the user's wallet.

I would describe it as a promising experiment in NFC-based delegated
payments, not yet a production-ready payment alternative.

## 11. Repository files used

This analysis is grounded in the following repository materials:

-   `README.md` --- project description, features, stack, contract
    interfaces, flows, notifications, and maturity notes.
-   `docs/architecture.md` --- system architecture, device provisioning,
    target payment flow, authorization model, trust boundaries, and
    implementation qualification.
-   `docs/testing.md` --- test summary, test coverage, security matrix,
    and explicit note that escrow authorization and merchant claim are
    not fully wired into the app.
-   `backend/contracts/device_registry/` --- device registration and
    ownership contract.
-   `backend/contracts/agent_registry/` --- delegated agent policy
    contract.
-   `backend/contracts/payment_escrow/` --- escrow, authorization,
    merchant claim, and fund recovery contract.
-   `frontend/` and `sdk/` --- mobile app and agent SDK implementation
    areas referenced by the repository documentation.

------------------------------------------------------------------------

**Bottom line:** Noir's interesting contribution is the combination of
NFC-triggered payments, device-specific delegated agents, on-chain
spending constraints, and escrow-based settlement. The architecture is
worth studying, but the repository itself identifies an important
integration gap: the intended escrow flow is not yet fully connected to
the app's tap-to-pay screens.



What is velo-ecosystem collection? 

# Velo --- Repository Analysis

> Repository: https://github.com/Velo-Ecosystem-Collection/Velo\
> Scope: This document explains the project using only the repository's
> README, source-tree information, and repository documentation. It does
> not rely on external articles or independent claims about Velo.

## 1. What is Velo?

Velo is a developer infrastructure and payment operations platform built
around the Stellar blockchain ecosystem.

Its central idea is to bring together the workflows teams need to build,
verify, observe, pay, and settle through one platform:

**Build → Verify → Observe → Pay → Settle**

Rather than being only a crypto wallet or payment gateway, Velo aims to
provide the operational layer around Stellar applications. It combines
project identity, smart-contract references, payment access, hosted
checkout, transaction verification, monitoring, webhooks, developer
SDKs, transaction-fee sponsorship, and settlement demonstrations.

The intended users include:

-   Stellar and Soroban developers.
-   Fintech companies.
-   Wallet providers.
-   Merchant platforms.
-   Businesses integrating stablecoin payments.
-   Teams that need transaction monitoring and payment notifications.

### Maturity and deployment status

The repository labels Velo as **alpha software for Stellar Testnet**.

Its README makes several important qualifications:

-   The checkout workflow is implemented, but live end-to-end
    qualification is still in progress.
-   Payment and observability capabilities have implementation and
    live-qualification distinctions.
-   PDAX settlement is limited to UAT and demo flows.
-   Mainnet readiness and production settlement are not claimed.
-   Mainnet contract deployment mechanics exist, but that does not
    establish production readiness.

These qualifications matter. A feature having code, SDK methods, or a
Testnet demonstration does not automatically mean it is ready for
production use.

## 2. What problem does Velo solve?

Building a Stellar application involves more than writing smart
contracts.

A team may separately need:

-   Project and contract identity.
-   Wallet connection and authentication.
-   Payment-intent creation.
-   Hosted checkout.
-   Blockchain transaction verification.
-   Contract event monitoring.
-   Transaction debugging.
-   Signed notifications to merchant backends.
-   Transaction-fee sponsorship.
-   Stablecoin conversion and local payout workflows.

These capabilities can otherwise be scattered across different services,
scripts, dashboards, and manual processes.

Velo attempts to consolidate those operations into one
developer-oriented platform.

### Example: a merchant accepting Stellar payments

1.  A merchant creates a project in Velo.
2.  The merchant connects a Stellar wallet and registers official
    contract references.
3.  The merchant creates a PaymentIntent through Velo's API or SDK.
4.  Velo returns a hosted checkout URL.
5.  The customer opens checkout, connects a Stellar wallet, and submits
    a payment.
6.  Velo's backend independently verifies the transaction against the
    intended payment details.
7.  The PaymentIntent is marked paid only after verification.
8.  Velo sends a signed webhook to the merchant's backend.
9.  The merchant can use the documented PDAX UAT workflow to demonstrate
    conversion and local payout.

The main value proposition is that the merchant does not have to
assemble every surrounding Stellar payment and operational component
independently.

## 3. The Velo operating loop

### 3.1 Build --- project and developer infrastructure

Developers create and manage projects in Velo.

The repository describes project features such as:

-   Registry-backed project identity.
-   Owner-scoped project names.
-   Official contract references.
-   API key management.
-   Payment-access configuration.
-   Developer APIs and SDKs.
-   Gas Station integration.
-   Soroban Playground.

The goal is to give a Stellar application a shared project context for
its operational workflows.

### 3.2 Verify --- project and contract provenance

Velo uses the `VeloRegistry` Soroban contract to associate project
identity with an owner and official contract references.

The `VeloPayAccess` contract reads Registry state to control payment
access.

This provides an on-chain relationship between the project and the
contracts it identifies as official.

**Important limitation:** The README marks live validation as pending.
It also says the current dashboard login checks a connected Stellar
address's format but does not independently prove wallet ownership.
SEP-10 authentication remains on the roadmap.

### 3.3 Observe --- transaction and contract monitoring

Velo provides tools for inspecting blockchain activity and application
operations.

The repository describes:

-   Stellar transaction inspection.
-   Transaction debugging.
-   Soroban contract-event monitoring.
-   Payment activity tracking.
-   Webhook delivery logs.
-   Operational telemetry and redaction helpers.

The backend uses Stellar Horizon and RPC-related services to verify
transactions, reconcile pending payments, inspect transaction results,
and poll supported Soroban events.

This matters because a blockchain application needs to know what
actually happened on the ledger, not only what the frontend attempted to
submit.

### 3.4 Pay --- PaymentIntents and hosted checkout

Velo provides a payment API and server-side SDK.

A merchant creates a PaymentIntent or checkout session with an amount,
asset, description, and return URLs. Velo returns a hosted checkout URL
that the merchant can send to the customer.

Example from the repository's SDK documentation:

``` typescript
import { Velo } from "@carts1024/velo-sdk";

const velo = new Velo({
  apiKey: process.env.VELO_API_KEY!,
  environment: "testnet",
});

const session = await velo.checkout.sessions.create({
  amount: "10.00",
  asset: "USDC",
  description: "Order #1001",
  successUrl: "https://yourdomain.com/success",
  cancelUrl: "https://yourdomain.com/cancel",
});

console.log(session.checkoutUrl);
```

The customer connects a supported Stellar wallet and submits the
payment.

#### The important part: backend ledger verification

A browser callback or success-page redirect cannot mark a PaymentIntent
as paid.

Instead, the backend verifies the submitted transaction against the
intended:

-   Source account.
-   Destination account.
-   Asset.
-   Amount.

Only after the backend has validated the transaction against Stellar
does it update the PaymentIntent to `paid` and schedule the
`payment.succeeded` event.

This is one of Velo's most important trust decisions: payment truth
comes from ledger evidence, not a frontend claim.

### 3.5 Settle --- stablecoin conversion and local payout

Velo includes a PDAX integration for demonstrating the next stage after
collecting Stellar-based stablecoin payments.

The repository describes a UAT workflow involving:

-   PDAX UAT balances.
-   Conversion quotes.
-   Trades.
-   InstaPay withdrawals.
-   Provider callbacks.
-   Normalized merchant settlement events.

This is relevant to Philippine businesses because it demonstrates a
possible bridge between Stellar stablecoin collection and local payout
workflows.

However, the README explicitly limits this to sandbox/UAT and demo
flows. It is not a production settlement service.

## 4. Features that stand out

### 4.1 Gas Station --- sponsored Stellar transaction fees

This is one of Velo's most technically interesting features.

Normally, a user needs XLM to pay Stellar network transaction fees. Velo
Gas Station lets an application sponsor the fee for eligible,
user-signed Stellar Testnet Soroban transactions.

The flow is:

1.  The application creates an unsigned Soroban transaction.
2.  The user's wallet signs the inner transaction.
3.  The browser sends the signed XDR to the application's own backend.
4.  The backend calls Velo through the server-side SDK.
5.  Velo checks the API key, policy, quota, and contract allow-list.
6.  Velo's relayer submits a FeeBump transaction that supplies the fee.
7.  Velo reports the execution status and fee evidence to the backend.

The user still controls and signs the inner transaction. Velo's relayer
supplies the fee source and handles submission.

The repository documents controls such as:

-   Project daily XLM sponsorship cap.
-   Per-wallet hourly request quota.
-   Allowed-contract list.
-   Explicit owner activation and pause controls.
-   Idempotency keys.
-   Recovery when submission has an uncertain outcome.
-   Server-only handling of API keys and signed transaction data.

The documented Gas Station flow is Testnet alpha. It is not a
general-purpose mechanism for Velo to sign arbitrary user transactions.

### 4.2 Soroban Contract Playground

Velo includes a Playground for exploring Soroban smart contracts.

The README describes the ability to:

-   Load live contract specifications.
-   Inspect contract methods.
-   Simulate calls.
-   Review exact XDR.
-   Invoke eligible contracts on Testnet with a connected wallet.

This gives developers a way to inspect and experiment with contract
calls inside the same ecosystem as the project dashboard and payment
tools.

Mainnet support is limited to inspection and simulation, according to
the README.

### 4.3 Ledger-verified payment processing

This is arguably Velo's strongest architectural decision.

A payment is not considered successful simply because:

-   The browser redirected to a success page.
-   The wallet returned a response.
-   The frontend displayed a confirmation.

The backend independently checks the Stellar transaction against the
intended source, destination, asset, and amount.

This helps prevent false payment confirmations caused by trusting
client-side state.

### 4.4 Signed webhooks

Velo sends payment and other application events to merchant endpoints.

The SDK documentation describes:

-   HMAC-SHA256 signatures.
-   Signature verification helpers.
-   Delivery retries.
-   Secret rotation.
-   Delivery logs.
-   Event version handling.
-   Delivery-ID deduplication.

Merchants can verify that an incoming webhook payload is authentic and
has not been modified.

An important implementation detail: signature verification requires the
original, unparsed request body. The SDK documentation also says
consumers must deduplicate deliveries using the delivery ID;
exactly-once network transport is not guaranteed.

### 4.5 Dual-anchor routing

The SDK documents two checkout anchor choices:

-   `inhouse`
-   `pdax`

A merchant can select an anchor when creating a checkout session.

The returned PaymentIntent can include:

-   Anchor.
-   Receiver address.
-   Receiver memo.
-   Anchor deposit currency.
-   Payer address.
-   Correlation ID.
-   Payment status.

For PDAX, a PaymentIntent can initially have `awaiting_route` status
while the receiving route is resolved. Integrations should wait for the
intent to become `created` before constructing a payment using its
destination fields.

This design allows checkout to account for different provider routing
and deposit requirements.

### 4.6 Project identity and contract registry

`VeloRegistry` records project identity and official contract
references. The repository also describes owner-scoped names and
owner-only project retirement.

`VeloPayAccess` reads Registry state to determine payment access and
checkout credits.

This connects project identity and contract provenance to payment
functionality rather than treating each integration as an unrelated
component.

### 4.7 Developer SDK and integration examples

The repository provides the server-side package:

`@carts1024/velo-sdk`

The documented SDK features include:

-   Checkout session creation.
-   PaymentIntent retrieval.
-   Gas sponsorship and submission.
-   Transaction status recovery.
-   Webhook signature verification.
-   Idempotency.
-   Bounded retries and request timeouts.
-   Anchor-aware routing.

The repository also includes Express and Next.js integration examples.

The SDK is marked alpha and intended for server-side environments. API
keys, webhook secrets, and signed transaction data should not be exposed
in browser code.

### 4.8 Wallet integrations

The repository uses Stellar Wallets Kit for supported wallet connection
and transaction signing.

It also contains a separate `@carts1024/velo-wallets` package for
browser, React, and custom-element integrations.

Wallet connection and wallet ownership verification are different
things. The README explicitly says the current dashboard login does not
independently prove wallet ownership, while SEP-10 authentication is
planned.

### 4.9 Billing and Velo credits

The README mentions Velo credits and top-ups through policy-gated
billing controls.

Mainnet enforcement remains gated. The repository should therefore be
read as describing alpha billing functionality rather than a mature,
production billing system.

## 5. Technical architecture

Velo uses a monorepo architecture.

  ---------------------------------------------------------------------------

  Layer                   Technology                  Responsibility

  ----------------------- --------------------------- -----------------------

  Frontend                Next.js 16, React 19        Dashboard, checkout,
                                                      public pages

  Language                TypeScript 5.9              Application and SDK
                                                      development

  Backend                 Convex                      Queries, mutations,
                                                      actions, crons, backend
                                                      workflows

  Blockchain              Stellar                     Payments and
                                                      transaction
                                                      verification

  Smart contracts         Rust, Soroban               Registry and payment
                                                      access

  Stellar libraries       Stellar Wallets Kit,        Wallet connection,
                          `@stellar/stellar-sdk`      signing, transaction
                                                      operations

  Merchant SDK            `@carts1024/velo-sdk`       Checkout, Gas Station,
                                                      webhooks

  Wallet package          `@carts1024/velo-wallets`   Browser, React, and
                                                      custom-element wallet
                                                      integrations

  Settlement              PDAX UAT client             Sandbox conversion and
                                                      payout workflows

  Monorepo tooling        pnpm, Turborepo             Workspace and build
                                                      management

  Quality tooling         oxlint, oxfmt, Husky,       Code quality and CI
                          GitHub Actions              
  ---------------------------------------------------------------------------

### 5.1 The two main Soroban contracts

#### `VeloRegistry`

Responsibilities described by the repository:

-   Stores project identity.
-   Associates projects with wallet ownership.
-   Stores official contract references.
-   Supports project lifecycle operations.

#### `VeloPayAccess`

Responsibilities described by the repository:

-   Reads project state from `VeloRegistry`.
-   Controls payment activation/access.
-   Supports checkout-credit logic.

Both contracts are written in Rust using `soroban-sdk`.

### 5.2 Backend and service packages

The repository map identifies these important packages:

  -----------------------------------------------------------------------

  Package                             Purpose

  ----------------------------------- -----------------------------------

  `packages/backend`                  Convex schema, functions, actions,
                                      crons, and tests

  `packages/observability`            Shared telemetry and redaction
                                      helpers

  `packages/pdax`                     Server-only PDAX UAT client

  `packages/stellar`                  Stellar transaction and contract
                                      helpers

  `packages/ui`                       Shared UI components and styles

  `packages/velo-sdk`                 Public alpha server-side SDK

  `packages/velo-wallets`             Browser, React, and custom-element
                                      wallet package
  -----------------------------------------------------------------------

The main web application lives in `apps/web`. Smart contracts live in
`contracts/registry` and `contracts/pay_access`.

## 6. How the system fits together

A simplified architecture:

``` text
Developer / Merchant
        |
        +----------------------+
        |                      |
   Velo Dashboard          Velo SDK / API
        |                      |
        +----------+-----------+
                   |
             Convex Backend
                   |
       +-----------+------------+
       |           |            |
   Stellar      Contracts    Gas Station
   Horizon /    Registry &    Relayer
   RPC          PayAccess
       |           |            |
       +-----------+------------+
                   |
              Stellar Testnet

Customer Wallet ---> Hosted Checkout
                           |
                     Stellar Payment
                           |
                   Backend Verification
                           |
                  PaymentIntent Updated
                           |
                  Signed Merchant Webhook
                           |
                      Merchant App

                  PDAX UAT Settlement
```

The browser can initiate or submit a payment, but the backend is
responsible for verifying ledger evidence before finalizing the
PaymentIntent.

## 7. Why Velo stands out

I would identify five major differentiators.

### 7.1 It treats blockchain application operations as one product

Many blockchain tools focus on one layer: wallets, RPC, smart contracts,
payment processing, or analytics.

Velo's proposition is to connect these layers into a shared operating
workflow.

The project identity, contract references, payment access, checkout,
transaction monitoring, webhooks, and settlement demonstrations share a
project context.

### 7.2 It prioritizes ledger evidence over frontend trust

This is a meaningful payment architecture decision.

A frontend can tell the backend that a transaction was submitted. It
cannot independently prove that the intended payment actually happened.

Velo's backend verification of source, destination, asset, and amount
provides a stronger basis for payment status.

### 7.3 It includes gas sponsorship without removing user signing

Gas Station addresses a practical onboarding problem: requiring users to
hold XLM just to pay transaction fees can add friction to a dApp.

Velo's approach keeps the user signing the inner transaction while a
relayer supplies the fee through a FeeBump transaction.

This is a useful combination of user authorization and
application-sponsored fees.

### 7.4 It connects smart contracts to operational developer tooling

The Registry and PayAccess contracts are not presented in isolation.
They are connected to the dashboard, APIs, SDK, contract Playground,
payment access, and monitoring workflows.

This is important because deploying a smart contract is only one part of
operating a real application.

### 7.5 It has a clear progressive integration path

A developer can begin with hosted checkout and later adopt more
infrastructure:

-   Project and contract identity.
-   Gas sponsorship.
-   Wallet integrations.
-   Contract inspection and simulation.
-   Transaction monitoring.
-   Webhooks.
-   Anchor routing.
-   Settlement workflows.

That is a more flexible product direction than requiring every team to
adopt every component immediately.

## 8. Testing and performance evidence

### 8.1 Repository testing instructions

The README documents these JavaScript and TypeScript quality commands:

``` bash
pnpm lint:fix
pnpm test
pnpm build
```

It also documents the Soroban contract test commands:

``` bash
cargo test --manifest-path contracts/registry/Cargo.toml
cargo test --manifest-path contracts/pay_access/Cargo.toml
```

And contract WASM builds:

``` bash
stellar contract build --manifest-path contracts/registry/Cargo.toml
stellar contract build --manifest-path contracts/pay_access/Cargo.toml
```

These are the repository's documented validation commands. This analysis
does not independently execute them.

### 8.2 Published benchmark in the README

The README reports a hosted PaymentIntent-creation endpoint benchmark
dated July 15, 2026.

  Metric                        Repository-reported result

  --------------------------- ----------------------------

  Attempted requests                                 3,000
  Successful requests                                3,000
  Success rate                                        100%
  Errors / dropped requests                          0 / 0
  Target throughput                     10 requests/second
  p50 latency                                     85.14 ms
  p95 latency                                    108.11 ms
  p99 latency                                    176.19 ms
  Maximum latency                                565.03 ms

The reported workload used 10 warmup requests, 3,000 measured requests,
concurrency of 25, and a 10-second timeout.

This is useful performance evidence, but it is a repository-reported
benchmark under a specific workload. It should not be interpreted as
proof of production-scale performance or independently verified
availability.

## 9. Limitations and risks visible in the repository

### 9.1 Alpha and Testnet maturity

The project is explicitly alpha. Checkout live end-to-end qualification
is still in progress, and PDAX settlement is limited to UAT/demo
workflows.

Mainnet deployment scripts do not mean the full product is
production-ready.

### 9.2 Wallet authentication is not yet full SEP-10

The README says the current dashboard login checks the connected address
format but does not independently prove ownership of that address.

SEP-10 authentication infrastructure remains on the roadmap.

This is an important distinction for a platform that associates projects
and permissions with wallet identities.

### 9.3 Gas Station introduces managed relayer custody

The Gas Station documentation says Velo-managed relayer keys are stored
as authenticated ciphertext in Convex and can be decrypted by the
trusted backend.

Plaintext secrets are not persisted, but the backend still has the
ability to decrypt the keys. This creates operational responsibilities
around encryption key management, backups, rotation, access controls,
and incident response.

The documentation explicitly notes that loss of all applicable
encryption key versions means loss of access to those accounts.

### 9.4 Gas Station is Testnet alpha

The documented Gas Station flow is for eligible Stellar Testnet Soroban
transactions. It has policy limits, an allow-list, and explicit
activation controls.

It should not be described as a generally available Mainnet gas
sponsorship service.

### 9.5 PDAX settlement is not production settlement

The repository describes UAT balances, sandbox conversion, and demo
payout flows. This is a useful integration demonstration, but it does
not establish production fiat settlement, custody, compliance, or
liquidity.

### 9.6 Live qualification is still needed

The README distinguishes implemented features from live validation and
end-to-end qualification.

For example, it says wallet testing with real devices and certain live
flows still require qualification. Automated browser tests alone do not
prove real wallet compatibility.

### 9.7 Public API rate limiting needs production hardening

The README's alpha boundaries explicitly say public API rate limiting
still needs distributed production hardening.

This is important for a platform that intends to serve merchant and
developer traffic.

### 9.8 Mainnet security and operations are not established

The contract deployment documentation warns that deployment mechanics
are not proof of completed security, audit, custody, or
operational-readiness requirements.

The README calls for reviewed commits, authorization and storage review,
deployer-key custody procedures, peer review, and appropriate audit or
documented risk acceptance before high-value deployments.

## 10. Roadmap items

The README distinguishes roadmap items from currently available
features.

Items listed include:

### Payments, identity, and accounts

-   SEP-10 authentication infrastructure.
-   Smart-account infrastructure.
-   SEP-24 deposit and withdrawal infrastructure.

### Standards and developer tooling

-   SDK support for SEP-6, SEP-10, SEP-24, SEP-31, SEP-38, and SEP-45.
-   Broader developer-operations infrastructure.

### Network and operations infrastructure

-   Full Stellar RPC gateway.
-   Distributed indexing layer.
-   Production request logs and operational visibility.

### Exploring

-   Deeper Stellar Anchor integration.
-   A reusable Stellar Anchor SDK, subject to exploration findings.

These should be treated as future direction, not current product
capabilities.

## 11. My thoughts

My assessment is that Velo is more interesting as a **Stellar developer
operations platform** than as a standalone crypto payment gateway.

The payment flow is important, but the broader idea is to give
developers one place to manage the operational infrastructure
surrounding a Stellar application.

### What I like

**1. The product has a coherent operating model.**\
Build, Verify, Observe, Pay, and Settle are connected stages rather than
unrelated features. This gives the platform a clear product identity.

**2. Backend ledger verification is a strong design choice.**\
The rule that a browser cannot declare a payment successful is essential
for payment integrity. It reduces dependence on client-side claims.

**3. Gas Station solves a real onboarding problem.**\
Users should not necessarily need to understand or separately acquire
XLM just to pay transaction fees for every application interaction.
Keeping the user as signer while sponsoring eligible fees is a useful
model.

**4. The SDK and webhook design show attention to integration
realities.**\
Idempotency, bounded retries, typed errors, status recovery, HMAC
signatures, and delivery deduplication are details that matter in real
merchant integrations.

**5. The project connects contracts to actual application workflows.**\
Registry and PayAccess are integrated with the dashboard, backend, SDK,
checkout, and developer tools. That is more useful than shipping
contracts without the surrounding developer experience.

### What concerns me

**1. The scope is ambitious.**\
Velo is attempting to cover identity, contracts, payment processing, gas
sponsorship, observability, SDKs, wallet integrations, billing, and
settlement. Each of these areas can become a substantial product on its
own.

The challenge will be maintaining reliability and security across all of
them.

**2. Authentication needs to mature.**\
The repository's own qualification about address-format checking versus
actual wallet ownership is important. A platform associating projects
and permissions with wallet identities needs strong authentication
before production use.

**3. Relayer custody creates a meaningful security boundary.**\
Gas sponsorship is useful, but managed relayer keys create operational
risk. Encryption, key rotation, backups, access controls, and incident
procedures need to be treated as core infrastructure.

**4. The settlement story is not finished.**\
PDAX UAT demonstrates a direction, especially for Philippine payout
workflows, but real production settlement requires provider reliability,
liquidity, compliance, operational support, and failure handling.

**5. Performance claims need broader qualification.**\
The benchmark is useful, but 3,000 requests at 10 requests per second is
a limited workload. It does not establish behavior under larger
concurrency, long-duration load, provider failures, or production
traffic.

### What I would prioritize

If I were evaluating the engineering roadmap, I would prioritize:

1.  Complete and repeatedly qualify the end-to-end checkout lifecycle.
2.  Implement strong wallet ownership authentication.
3.  Complete Gas Station security and operational qualification.
4.  Harden webhook delivery, idempotency, and reconciliation under
    failure conditions.
5.  Establish production-grade observability and distributed rate
    limiting.
6.  Complete independent security review before handling meaningful
    production value.
7.  Mature the PDAX integration only after the core payment lifecycle is
    reliable.

### Overall verdict

Velo is a promising developer infrastructure project with a broader
scope than a typical Stellar payment demo.

Its strongest idea is not simply accepting stablecoin payments. It is
connecting project identity, contract provenance, transaction-fee
sponsorship, ledger-verified checkout, observability, webhooks, and
settlement into one developer workflow.

I would describe it as a **promising Stellar application operations
platform in Testnet alpha**, with several technically meaningful
components and a substantial production-readiness gap still to close.

## 12. Repository files and areas used

This analysis is grounded in the repository's README, repository
structure, and documentation surfaced from the repository.

Important files and areas:

-   `README.md` --- product overview, operating loop, capabilities,
    architecture, stack, maturity boundaries, benchmark, and roadmap.
-   `docs/velo-gas-station.md` --- Gas Station architecture, relayer
    setup, custody, sponsorship policy, recovery, and security guidance.
-   `packages/velo-sdk/README.md` --- server-side SDK, checkout, Gas
    methods, retries, idempotency, anchor routing, and webhook
    verification.
-   `apps/web/` --- Next.js application, console, checkout, and public
    pages.
-   `packages/backend/` --- Convex schema, functions, actions, crons,
    and tests.
-   `packages/observability/` --- shared telemetry and redaction
    helpers.
-   `packages/stellar/` --- Stellar transaction and contract helpers.
-   `packages/pdax/` --- server-only PDAX UAT client.
-   `packages/velo-sdk/` --- public alpha server-side SDK.
-   `packages/velo-wallets/` --- browser, React, and custom-element
    wallet package.
-   `contracts/registry/` --- Soroban project registry contract.
-   `contracts/pay_access/` --- Soroban payment-access contract.
-   `examples/` --- Express and Next.js merchant integration examples.
-   `benchmarks/` --- benchmark artifacts and performance reports.

------------------------------------------------------------------------

## Bottom line

Velo is trying to become an operational layer for teams building on
Stellar. Its most distinctive parts are ledger-verified checkout,
sponsored Soroban transaction fees, project/contract provenance, and the
integration of these features with SDKs, webhooks, monitoring, and
settlement workflows.

The architecture is worth studying. The repository itself is clear that
the platform remains alpha: live qualification, authentication maturity,
production security, rate limiting, and production settlement are still
important gaps.





note that we have already submitted the forms for nov4.
