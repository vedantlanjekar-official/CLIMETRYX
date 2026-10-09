import "@/components/report/report.css";
import { SatelliteMap } from "@/components/maps/satellite-map";
import { FloodExposureBar, ForecastChart, RiverChart } from "@/components/report/charts";
import { riverOutlook } from "@/lib/integrations/open-meteo/river-stats";
import { FLOOD_CLASSES } from "@/lib/integrations/world-bank-flood/classes";
import type { ReportModel } from "@/lib/reports/model";
import { SCORE_DIRECTION } from "@/lib/scoring/types";

type Tone = "green" | "amber" | "red" | "grey" | "blue";

const scoreTone = (score: number | null): Tone => (score === null ? "grey" : score < 25 ? "green" : score < 50 ? "amber" : score < 75 ? "amber" : "red");
const statusTone = (status: string): Tone => (status === "available" ? "green" : status === "partial" ? "amber" : "grey");
const titleCase = (text: string) => `${text[0]!.toUpperCase()}${text.slice(1)}`;
const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "—";
const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "UTC" }) : "—";
const money = (value: number | null, currency: string) => (value === null ? "—" : `${currency} ${Math.round(value).toLocaleString("en-IN")}`);
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;
const HORIZON: Record<string, string> = { now: "Now", "30_days": "Within 30 days", "90_days": "Within 90 days", "12_months": "Within 12 months" };

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="rx-pill" data-tone={tone === "green" ? undefined : tone}>
      {children}
    </span>
  );
}

function SectionHead({ num, title, lede }: { num?: string; title: string; lede?: string }) {
  return (
    <div className="rx-section-head">
      {num ? <span className="rx-section-num" aria-hidden>{num}</span> : null}
      <h2 className="rx-h2">{title}</h2>
      {lede ? <p className="rx-muted w-full text-sm">{lede}</p> : null}
    </div>
  );
}

export function ReportView({ report, mode }: { report: ReportModel; mode: "preview" | "saved" }) {
  const { result, narrative, site } = report;
  const { score, context } = result;
  const satellite = result.satellite;
  const latest = satellite?.status === "available" ? satellite.latest ?? null : null;
  const previous = satellite?.previousYear ?? null;
  const exposure = context.floodExposure;
  const river = context.river;
  const outlook = river ? riverOutlook(river.forecast, river.statistics) : null;
  const alerts = context.alerts;
  const projections = context.projections;
  const pinClass = exposure?.summary ? FLOOD_CLASSES.find(({ key }) => key === exposure.summary!.pinClass) : null;
  const missingSlots = score.evidenceSlots.filter((slot) => !slot.available);

  return (
    <article className="rx">
      <div className="rx-report">
        <header>
          <p className="rx-eyebrow">{mode === "preview" ? "Preview, not saved" : "Saved assessment"} · {fmtTime(report.generatedAt)}</p>
          <h2 className="rx-h1">{report.businessName}</h2>
          <p className="rx-muted text-sm">
            {site.label} · {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} · {site.userConfirmed ? "pin confirmed" : "lower precision accepted"} · {result.methodologyVersion}
          </p>
        </header>

        <div className="rx-grid rx-hero mt-5">
          <div className="rx-card rx-card-soft">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rx-h3">Climate-disruption vulnerability</p>
              <Pill tone={result.status === "completed" ? "green" : result.status === "failed" ? "red" : "amber"}>{result.status.replaceAll("_", " ")}</Pill>
            </div>
            <div className="rx-score">
              <span className="rx-score-value">{score.score ?? "—"}</span>
              <span className="rx-muted pb-1.5">/ 100</span>
            </div>
            <p className="mt-1 font-semibold">{score.band ?? "Not enough evidence to show an indicator"}</p>
            {score.score !== null ? (
              <>
                <div className="rx-gauge" aria-hidden>
                  <span className="rx-gauge-mark" style={{ left: `${score.score}%` }} />
                </div>
                <div className="rx-gauge-scale" aria-hidden>
                  <span>0 lower</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100 higher</span>
                </div>
              </>
            ) : null}
            <div className="mt-4">
              <div className="flex justify-between text-sm">
                <span>Evidence completeness</span>
                <span className="rx-num">{score.evidenceCompleteness}%</span>
              </div>
              <div className="rx-bar mt-1">
                <span style={{ width: `${score.evidenceCompleteness}%` }} />
              </div>
            </div>
            <p className="rx-caption">{SCORE_DIRECTION}</p>
            {result.change.previousScore !== null ? (
              <p className="mt-2 text-sm">
                Previous assessment {result.change.previousScore} → now {result.change.nextScore ?? "—"}
                {result.change.delta !== null ? ` (${signed(result.change.delta)})` : ""}. {result.change.reasons[0] ?? ""}
              </p>
            ) : null}
          </div>

          <div className="rx-card">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rx-h3">Summary</p>
              <Pill tone={narrative.generatedBy === "ai" ? "blue" : "grey"}>
                {narrative.generatedBy === "ai" ? `Written by AI from the evidence below` : "Written by rules"}
              </Pill>
            </div>
            <p className="mt-2 text-lg font-semibold leading-snug">{narrative.headline}</p>
            <p className="mt-2">{narrative.summary}</p>
            {narrative.watchItems.length ? (
              <ul className="rx-list mt-3 text-sm">
                {narrative.watchItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
            <p className="rx-caption">
              {narrative.generatedBy === "ai"
                ? `Model ${narrative.model}. Every number and claim was checked against the evidence; the summary never changes the score.`
                : narrative.fallbackReason ?? "Deterministic summary from the scored evidence."}
            </p>
          </div>
        </div>

        <section className="rx-section" aria-labelledby="rx-map-title">
          <SectionHead title="Site and satellite view" lede="Street map, a cloud-free 2023 mosaic, and the latest clear Sentinel-2 scene with its vegetation index. Imagery is context for a reviewer, not evidence of damage or flood depth." />
          <h3 id="rx-map-title" className="sr-only">Map</h3>
          <div className="rx-grid rx-split">
            <SatelliteMap
              latitude={site.latitude}
              longitude={site.longitude}
              label={site.label}
              bufferMeters={satellite?.bufferMeters ?? 500}
              scene={latest ? { date: latest.acquisitionTime.slice(0, 10), trueColor: latest.tiles.trueColor, ndvi: latest.tiles.ndvi } : null}
            />
            <div className="rx-card rx-card-soft">
              <p className="rx-h3">Satellite indicators</p>
              {latest ? (
                <>
                  <dl className="rx-kv mt-3">
                    <dt>Scene</dt>
                    <dd>{fmtDate(latest.acquisitionTime)} · {latest.localCloudPct}% cloud over the square</dd>
                    <dt>Vegetation (NDVI)</dt>
                    <dd>mean {latest.ndvi.mean} · median {latest.ndvi.median}</dd>
                    <dt>Surface water (NDWI)</dt>
                    <dd>mean {latest.ndwi.mean} · median {latest.ndwi.median}</dd>
                    {previous ? (
                      <>
                        <dt>A year earlier</dt>
                        <dd>
                          {fmtDate(previous.acquisitionTime)}: NDVI {previous.ndvi.mean} ({signed(Math.round((latest.ndvi.mean - previous.ndvi.mean) * 1000) / 1000)}), NDWI {previous.ndwi.mean}
                        </dd>
                      </>
                    ) : null}
                    <dt>Pixels</dt>
                    <dd>{latest.ndvi.pixels.toLocaleString("en-IN")} at 10 m</dd>
                  </dl>
                  <p className="rx-caption">
                    NDVI near 0 means roofs, roads or bare soil; above 0.5 means dense vegetation. NDWI above 0 usually means open water. Context only; not used in the score.
                  </p>
                </>
              ) : (
                <p className="rx-muted mt-2 text-sm">{satellite?.reason ?? "Satellite indicators were not computed."} Missing imagery is unknown, not safe.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rx-section">
          <SectionHead
            num="1"
            title="Hazard and regional context"
            lede="What the weather, official alerts and regional datasets say about this location. The four hazard screens feed the hazard component; the regional datasets below them are context and carry no weight."
          />
          <div className="rx-grid rx-grid-4">
            {result.hazards.indicators.map((indicator) => (
              <div key={indicator.hazard} className="rx-card">
                <div className="flex items-center justify-between gap-2">
                  <p className="rx-h3">{titleCase(indicator.hazard)}</p>
                  <Pill tone={indicator.score === null ? "grey" : scoreTone(indicator.score)}>{indicator.score === null ? "not available" : `${indicator.score} / 100`}</Pill>
                </div>
                <p className="mt-1">
                  <Pill tone={statusTone(indicator.status)}>{indicator.status.replace("_", " ")}</Pill>
                </p>
                <p className="mt-2 text-sm">{indicator.summary}</p>
                <details className="rx-details mt-2">
                  <summary>Thresholds and limits</summary>
                  <p className="text-sm">{indicator.thresholdOrigin}</p>
                  <ul className="rx-list mt-2 text-sm rx-muted">
                    {indicator.limitations.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </details>
              </div>
            ))}
          </div>

          <div className="rx-grid rx-grid-2 mt-4">
            <div className="rx-card">
              <p className="rx-h3">Seven-day forecast</p>
              <div className="mt-2">
                <ForecastChart days={report.forecast} />
              </div>
              {report.climatologyLabel ? <p className="rx-caption">Local thresholds from {report.climatologyLabel}.</p> : null}
            </div>
            <div className="rx-card">
              <div className="flex flex-wrap items-center gap-2">
                <p className="rx-h3">Official alerts</p>
                <Pill tone={!alerts || alerts.status !== "available" ? "grey" : alerts.matched.length ? "red" : "green"}>
                  {!alerts || alerts.status !== "available" ? "not checked" : alerts.matched.length ? `${alerts.matched.length} active here` : "none active here"}
                </Pill>
              </div>
              {alerts?.matched.length ? (
                <ul className="mt-3 grid gap-3">
                  {alerts.matched.map((alert) => (
                    <li key={alert.identifier ?? alert.headline} className="rx-note" data-tone={/extreme|severe/i.test(alert.severity) ? "red" : "amber"}>
                      <p className="font-semibold">{alert.event} · {alert.severity}{alert.urgency ? ` · ${alert.urgency}` : ""}</p>
                      <p className="text-sm">{alert.headline}</p>
                      <p className="rx-caption">{alert.source} · valid {fmtTime(alert.validFrom)} to {fmtTime(alert.validTo)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm">{alerts?.detail ?? "Official alerts were not checked."}</p>
              )}
              <p className="rx-caption">{alerts?.coverage ?? ""} Source: NDMA SACHET (IMD, CWC and State Disaster Management Authorities).</p>
            </div>
          </div>

          <div className="rx-grid rx-grid-2 mt-4">
            <div className="rx-card">
              <div className="flex flex-wrap items-center gap-2">
                <p className="rx-h3">Modelled flood exposure nearby</p>
                <Pill tone="grey">context · weight 0</Pill>
              </div>
              {exposure?.summary && exposure.status === "available" ? (
                <>
                  <p className="mt-2 text-sm">
                    In a modelled 1-in-100-year flood, <strong>{exposure.summary.shareAtLeastModerate}%</strong> of the {exposure.summary.people.toLocaleString("en-IN")} residents within about {exposure.bufferMeters} m live where water would exceed 0.15 m.
                    {pinClass ? ` The pin cell is in the “${pinClass.label}” class.` : " The pin cell has no residents, so it has no class."}
                  </p>
                  <div className="mt-3">
                    <FloodExposureBar summary={exposure.summary} />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm">{exposure?.detail ?? "Not retrieved."} Unknown is not the same as safe.</p>
              )}
              <details className="rx-details mt-3">
                <summary>About this dataset</summary>
                <ul className="rx-list text-sm rx-muted">
                  {(exposure?.limitations ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
                {exposure?.file ? <p className="rx-caption">Tile {exposure.file}, World Bank DR0089139, CC BY 4.0.</p> : null}
              </details>
            </div>
            <div className="rx-card">
              <div className="flex flex-wrap items-center gap-2">
                <p className="rx-h3">River discharge, next 30 days</p>
                <Pill tone="grey">context · weight 0</Pill>
                {outlook && outlook.level !== "unknown" ? (
                  <Pill tone={outlook.level === "above_10yr_level" ? "red" : outlook.level === "above_typical_annual_peak" ? "amber" : "green"}>
                    {outlook.level === "above_10yr_level" ? "at or above 10-year level" : outlook.level === "above_typical_annual_peak" ? "above typical annual peak" : "below typical annual peak"}
                  </Pill>
                ) : null}
              </div>
              {river && river.status !== "unavailable" ? (
                <>
                  <div className="mt-2">
                    <RiverChart forecast={river.forecast} statistics={river.statistics} />
                  </div>
                  <p className="rx-caption">
                    {river.detail}
                    {river.statistics ? ` Record ${river.statistics.recordMaxM3s} m³/s on ${fmtDate(river.statistics.recordMaxDate)}.` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm">{river?.detail ?? "Not retrieved."}</p>
              )}
            </div>
          </div>

          <div className="rx-card mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rx-h3">Climate projections for this location</p>
              <Pill tone="grey">context · weight 0</Pill>
            </div>
            {projections?.status === "available" ? (
              <>
                <p className="rx-muted mt-1 text-sm">
                  Change from {projections.baseline} to {projections.future}, {projections.metrics[0]?.models ?? 0} CMIP6 high-resolution models.
                </p>
                <div className="rx-table-wrap mt-2">
                  <table className="rx-table">
                    <thead>
                      <tr>
                        <th>Measure</th>
                        <th>Baseline (model median)</th>
                        <th>Median change</th>
                        <th>Range across models</th>
                        <th>Agreement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projections.metrics.map((metric) => (
                        <tr key={metric.key}>
                          <td>{metric.label}</td>
                          <td className="rx-num">{metric.baselineMedian} {metric.unit}</td>
                          <td className="rx-num font-semibold">{signed(metric.changeMedian)} {metric.unit}</td>
                          <td className="rx-num">{signed(metric.changeMin)} to {signed(metric.changeMax)}</td>
                          <td className="rx-num">{metric.modelsAgreeOnSign} of {metric.models}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="rx-caption">{projections.limitations[0]} {projections.limitations[1]}</p>
              </>
            ) : (
              <p className="mt-2 text-sm">{projections?.detail ?? "Not retrieved."}</p>
            )}
          </div>
        </section>

        <section className="rx-section">
          <SectionHead
            num="2"
            title="Business vulnerability and resilience"
            lede="How sensitive the business is to disruption and how prepared it is, from the questionnaire. Excluded components are missing evidence, not good news."
          />
          <div className="rx-grid rx-split">
            <div className="rx-card">
              <div className="rx-table-wrap">
                <table className="rx-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Score</th>
                      <th>Weight</th>
                      <th>Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {score.components.map((component) => (
                      <tr key={component.id}>
                        <td>
                          <p className="font-semibold">{component.label}</p>
                          <div className="rx-bar mt-1.5 max-w-40">
                            <span style={{ width: `${component.score ?? 0}%`, background: component.included ? undefined : "transparent" }} />
                          </div>
                        </td>
                        <td className="rx-num">{component.included ? component.score : <Pill tone="grey">excluded</Pill>}</td>
                        <td className="rx-num">{component.included && component.effectiveWeight !== null ? `${Math.round(component.effectiveWeight * 100)}%` : "—"}</td>
                        <td className="text-sm">{component.included ? component.notes[0] ?? component.normalization : component.reasonExcluded ?? "No usable input."}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {score.renormalized ? <p className="rx-caption">Weights were renormalised across included components because some evidence is missing.</p> : null}
            </div>
            <div className="rx-card rx-card-soft">
              <p className="rx-h3">Main drivers</p>
              {narrative.drivers.length ? (
                <ol className="mt-2 grid gap-3">
                  {narrative.drivers.map((driver) => (
                    <li key={driver.title}>
                      <p className="font-semibold">{driver.title}</p>
                      <p className="text-sm">{driver.explanation}</p>
                      <p className="rx-cite">Evidence: {driver.evidence.join(", ")}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rx-muted mt-2 text-sm">No component had enough evidence to rank drivers.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rx-section">
          <SectionHead
            num="3"
            title="Financial sensitivity (hypothetical)"
            lede="What a disruption of a given length would cost, using the owner's figures and assumptions. These are scenarios, not forecasts, and not a credit assessment."
          />
          {result.financials || result.scenarios.length ? (
            <div className="rx-grid rx-split">
              <div className="rx-card">
                {result.scenarios.length ? (
                  <div className="rx-table-wrap">
                    <table className="rx-table">
                      <thead>
                        <tr>
                          <th>Disruption</th>
                          <th>Revenue at risk</th>
                          <th>Continuing costs</th>
                          <th>Cash after</th>
                          <th>Covered?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.scenarios.map((scenario) => (
                          <tr key={scenario.label}>
                            <td className="rx-num">{scenario.disruptionDays} days</td>
                            <td className="rx-num">{money(scenario.revenueAtRisk, scenario.currency)}</td>
                            <td className="rx-num">{money(scenario.continuingCosts, scenario.currency)}</td>
                            <td className="rx-num">{money(scenario.cashAfterScenario, scenario.currency)}</td>
                            <td>
                              {scenario.cashCoversScenario === null ? <Pill tone="grey">unknown</Pill> : scenario.cashCoversScenario ? <Pill tone="green">yes</Pill> : <Pill tone="red">no</Pill>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm">No disruption scenarios were defined.</p>
                )}
                {result.scenarios[0] ? <p className="rx-caption">Formula: {result.scenarios[0].formula}</p> : null}
              </div>
              <div className="rx-card rx-card-soft">
                <p className="rx-h3">Cash runway</p>
                <p className="mt-2 text-3xl rx-num">{result.financials?.runwayDays != null ? `${Math.round(result.financials.runwayDays)} days` : "—"}</p>
                <p className="text-sm">of fixed costs covered by reported cash.</p>
                <ul className="rx-list mt-3 text-sm rx-muted">
                  {(result.financials?.notes ?? []).slice(0, 3).map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
            </div>
          ) : (
            <p className="rx-note" data-tone="amber">Financial figures were not supplied, so this part is excluded. That is unknown, not low sensitivity.</p>
          )}
        </section>

        <section className="rx-section">
          <SectionHead title="What to do next" lede="Practical steps grounded in the drivers above. Costs are not estimated unless you supplied them." />
          <div className="rx-grid rx-split">
            <div className="rx-card">
              {narrative.actions.length ? (
                narrative.actions.map((action, index) => (
                  <div key={action.action} className="rx-action">
                    <span className="rx-action-num">{index + 1}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{action.action}</p>
                        <Pill tone={action.horizon === "now" ? "red" : action.horizon === "30_days" ? "amber" : "grey"}>{HORIZON[action.horizon]}</Pill>
                      </div>
                      <p className="mt-1 text-sm">{action.rationale}</p>
                      <p className="rx-cite">Evidence: {action.evidence.join(", ")}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm">No action was triggered by the available evidence.</p>
              )}
            </div>
            <div className="rx-card rx-card-soft">
              <p className="rx-h3">How to check progress</p>
              <ul className="mt-2 grid gap-3 text-sm">
                {result.recommendations.slice(0, 6).map((recommendation) => (
                  <li key={recommendation.action}>
                    <Pill tone={recommendation.priority === "high" ? "red" : recommendation.priority === "medium" ? "amber" : "grey"}>{recommendation.priority}</Pill>
                    <p className="mt-1">{recommendation.verificationMetric}</p>
                    <p className="rx-cite">{recommendation.dependency}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="rx-section">
          <SectionHead title="Data quality and sources" />
          <div className="rx-grid rx-grid-2">
            <div className="rx-card">
              <p className="rx-h3">Data-quality statement</p>
              <p className="mt-2 text-sm">{narrative.dataQuality}</p>
              <ul className="mt-3 grid gap-1 text-sm">
                {score.evidenceSlots.map((slot) => (
                  <li key={slot.id} className="flex items-center justify-between gap-3">
                    <span>{slot.label}</span>
                    {slot.available ? <Pill tone="green">present</Pill> : <Pill tone="grey">missing</Pill>}
                  </li>
                ))}
              </ul>
              {missingSlots.length ? <p className="rx-caption">Missing evidence is shown as missing. It is never counted as safe.</p> : null}
            </div>
            <div className="rx-card">
              <p className="rx-h3">Limitations</p>
              <ul className="rx-list mt-2 text-sm">
                {result.limitations.slice(0, 6).map((item) => <li key={item}>{item}</li>)}
              </ul>
              {result.limitations.length > 6 ? (
                <details className="rx-details mt-2">
                  <summary>{result.limitations.length - 6} more</summary>
                  <ul className="rx-list text-sm">
                    {result.limitations.slice(6).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>
          <div className="rx-card mt-4">
            <div className="rx-table-wrap">
              <table className="rx-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Provider</th>
                    <th>Retrieved</th>
                    <th>Valid for</th>
                    <th>Resolution</th>
                    <th>Licence</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.map((entry) => (
                    <tr key={entry.name}>
                      <td className="font-semibold">{entry.name}</td>
                      <td className="text-sm">{entry.attribution}</td>
                      <td className="rx-num text-sm">{fmtTime(entry.retrievedAt)}</td>
                      <td className="text-sm">{entry.validFrom || entry.validTo ? `${fmtDate(entry.validFrom)} – ${fmtDate(entry.validTo)}` : "Static"}</td>
                      <td className="text-sm">{entry.resolution}</td>
                      <td className="text-sm">{entry.licence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
