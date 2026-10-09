namespace Atlas;

public record Meta(string DatasetVersion, bool IsDemo, string GeneratedAt, string CoverageStatus, string Definition);
public record Citation(string SourceId, string SourceVersionId, string Title, string Publisher, string? Url, string Locator, string RetrievedAt, string? PublishedAt, bool IsDemo);
public record Envelope<T>(T Data, Meta Meta, IReadOnlyList<Citation> Sources, IReadOnlyList<string> Warnings) where T : notnull;
public record StateSummary(string Code, string NameEn, string NameZh, string CoverageStatus, decimal? Allocation190, decimal? Allocation491, int PublishedOccupationObservations);
public record StatesData(IReadOnlyList<StateSummary> Items, IReadOnlyList<string> ProgramYears, IReadOnlyList<string> Versions);
public record ScopeChoice(string Id, string? RoundId, string Stream, string ResidenceCategory, string PointsBasis, string ClassificationVersion, string? EventDate);
public record MetricValue(string Id, string MetricType, decimal? Value, string Unit, string Status, string? NullReason, string ProgramYear, string VisaSubclass, string? EventDate, string? PeriodStart, string? PeriodEnd, string PointsBasis, string? OccupationId, string SourceVersionId, string Locator, string? EoiEffectiveAt, string State, string Stream, string ResidenceCategory, string ClassificationVersion, string? RoundId, string? AsOfDate);
public record StateOverview(string Code, string NameEn, string NameZh, string PolicyStatus, string PolicySummary, IReadOnlyList<MetricValue> Allocations, IReadOnlyList<ScopeChoice> Scopes, IReadOnlyList<string> VisaSubclasses);
public record RankedItem(string OccupationId, string Code, string Title, string TitleZh, decimal Value, long Rank, string SourceVersionId, string Locator, string? EoiEffectiveAt);
public record TopData(string Status, string Title, string MetricType, IReadOnlyList<RankedItem> Items, int TieCount, int PublishedRecords, string? Reason);
public record OccupationSummary(string Id, string System, string Version, string Code, string Title, string TitleZh);
public record OccupationData(OccupationSummary Occupation, IReadOnlyList<MetricValue> Observations, string Status);
public record PercentageRow(decimal Lower, decimal Upper, long? Count, string Status, decimal? Percentage);
public record DistributionData(string Status, bool ChartAllowed, long? Denominator, string DenominatorDefinition, string CohortKind, string Reason, IReadOnlyList<PercentageRow> Bins);
public record TrendPoint(string ProgramYear, decimal Value, string PeriodEnd, bool IsYtd);
public record TrendData(string Status, string MetricType, string Unit, IReadOnlyList<TrendPoint> Items, string? Reason);
public record SourceData(string SourceId, string SourceVersionId, string Title, string Publisher, string? Url, string? TermsUrl, string License, string Hash, string RetrievedAt, string? PublishedAt, string? EffectiveDate, string? DecisionDate, string SnapshotScope, string ReviewNote, IReadOnlyList<string> DatasetVersions);
public record Interpretation(string Intent, IReadOnlyList<OccupationSummary> OccupationCandidates, IReadOnlyList<string> StateCandidates, string? VisaSubclass, string? ProgramYear, bool NeedsClarification, IReadOnlyList<string> MissingInputs);
public record InterpretRequest(string Text, string Locale = "zh", string Mode = "verified_historical");
public record AnswerRequest(string Question, string State, string VisaSubclass, string ProgramYear, string Mode, string Locale, string? OccupationId = null, string? DatasetVersion = null, bool Confirmed = false);
public record AnswerData(string AnswerMode, string Summary, IReadOnlyList<MetricValue> Facts, IReadOnlyList<string> Limitations, IReadOnlyList<string> MissingInputs);
public record QueryFilters(string Mode = "verified_historical", string ProgramYear = "2025-26", string VisaSubclass = "190", string SponsorshipType = "state", string Locale = "zh", string? DatasetVersion = null, string? Stream = null, string? ResidenceCategory = null, string? RoundId = null);
public record Release(string Key, string Mode, string Status);
public class ApiFailure(int status, string code, string message, object? choices = null) : Exception(message) { public int Status { get; } = status; public string Code { get; } = code; public object? Choices { get; } = choices; }
