/** Representative public `/api/performance/alertsummary/` response. */
export const alertSummaryFixture = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      alerts: [
        {
          amount_pct: 0.25,
          is_regression: true,
          new_value: 12.5,
          prev_value: 10,
          series_signature: { id: 101 },
        },
        {
          amount_pct: -0.1,
          is_regression: false,
          new_value: 9,
          prev_value: 10,
          series_signature: { id: 999 },
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
