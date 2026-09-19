# Gate 1 · Screen flows and rules

## Implemented local-demo paths

Overview → breakfast/lunch/dinner toggle → meal totals/rate/bill recalculate → browser storage.

Overview → add guest meal → count attributed to Rafi → statement recalculates.

Overview or Bazar → add expense → amount/date/payer/funding-source validation → shared food allocation → fund/member balances update.

Accounts → select member → see contribution, charge and exact allocation explanation.

Accounts → CSV download → sample statement for six members.

Members → view statement. Invite action currently explains future flow.

## Proposed production flows (not implemented)

Landing → Google sign-in → create mess OR open expiring invitation → join request → manager approval → dashboard.

Meal entry → planned/confirmed state → cutoff validation → save with record version → shared audit event. Missing entry is distinct from zero.

Member expense submission → pending approval → manager approval/rejection → official ledger/audit. Personal purchases and fund purchases use different postings.

Deposit report → manager checks actual receipt → confirms → contribution and fund cash increase together.

Month close → missing data/pending items/disputes resolved → cash verified → member preview → versioned locked statement → confirmed transfers or carry-forward.

## Rule choices for the later backend

- Asia/Dhaka; BDT; money stored as integer paisa.
- Standard breakfast/lunch/dinner weights are configurable at mess setup. The demo uses 1/1/1, not a claim about every mess.
- Guests are charged to their hosting member.
- Food expenses are proportional to meal units; other bills require explicit split rules.
- Invite possession is not approval; roles are checked server-side.
- Old records retain member and weight history.
- Setup must ask each mess about meal cutoffs. No universal cutoff is assumed.
- Manager corrections need reason and audit; locked months need versioned reopening.

## Interview worksheet (not yet conducted)

Ask five managers and ten members, with permission:
1. Show the last disputed bill with names removed. What actually went wrong?
2. Who records meals? Is no entry different from no meal?
3. What are breakfast/half-meal/guest rules?
4. When does the meal list stop changing? How are late changes handled?
5. Do shoppers use personal cash, fund cash or both?
6. Which household bills use equal versus custom shares?
7. What happens when someone joins or leaves mid-month?
8. Who holds fund cash? How is cash reconciled?
9. Would members review their bills themselves? On which devices?
10. Can the manager recreate a real month and independently verify our result?

User review requested: screen clarity, terminology, daily-entry flow and the proposed green/cream visual direction. Interviews and real-device testing remain outstanding.
