# User guide

1. Open the landing page and read the responsible-use notice.
2. Create an account. Email confirmation depends on the Supabase project settings. The verify page does not pretend a message was delivered.
3. Sign in. You land on **Your businesses** (`/businesses`), the only page in the workspace. It lists the businesses you created; open one to see its AI reports.
4. Choose **Create new business**. The form opens. Answers are saved to your workspace in the database as you type and whenever you press **Save draft**; your workspace is created on the first save. An unsubmitted draft appears on **Your businesses** with **Continue draft**. Enter the business, then each operating site. Confirm the pin, or explicitly accept lower precision. A place-name match is not a rooftop.
5. Add suppliers, operations, utilities, past incidents, resilience measures and cost lines you can source. Leave unknown answers as unknown.
6. Financial figures are optional and need explicit consent. Monthly revenue history (at least 12 months) lets reports compare revenue with past weather at the site.
7. Preview calculates a result without saving it. Submit saves the business and takes you to its page, where the climate analysis progress is shown.
8. When the analysis finishes, all ten core AI reports are generated automatically for the primary site. The page updates on its own; each report shows queued, writing, ready, ready with limitations, or failed (with a retry button). Reports need an owner, admin or analyst role because they contain restricted financial figures.
9. Open a report to read it, compare it with an earlier version, and download PDF, Excel or CSV. **Regenerate all reports** creates new versions; it never deletes an earlier one.

Reports are decision support. They are not a probability of default, a credit rating or a loan decision. See `docs/REPORTS.md` for how each report is built.
