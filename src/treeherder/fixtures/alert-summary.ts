/**
 * Representative public `/api/performance/alertsummary/` response.
 *
 * Field shapes and values follow the live API: `amount_pct` is an unsigned
 * magnitude, alerts carry their own triage `status`, and a reassigned alert
 * points at the summary that owns it through `related_summary_id`.
 */
export const alertSummaryFixture = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      alerts: [
        {
          amount_pct: 8.94,
          id: 246261,
          is_regression: true,
          new_value: 12.5,
          prev_value: 10,
          related_summary_id: null,
          series_signature: { id: 101 },
          status: 0,
        },
        {
          amount_pct: 10,
          id: 246262,
          is_regression: false,
          new_value: 9,
          prev_value: 10,
          related_summary_id: null,
          series_signature: { id: 999 },
          status: 0,
        },
      ],
      bug_number: 123456,
      id: 55,
      push_timestamp: 120,
      revision: 'alert-revision',
      status: 0,
    },
  ],
};
