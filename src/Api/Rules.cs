using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
namespace Atlas;

public static class Rules
{
    public static readonly string[] StateCodes = ["WA", "NT", "SA", "QLD", "NSW", "VIC", "TAS", "ACT"];
    public static readonly Dictionary<string, (string En, string Zh)> Names = new() { ["WA"] = ("Western Australia", "西澳大利亚"), ["NT"] = ("Northern Territory", "北领地"), ["SA"] = ("South Australia", "南澳大利亚"), ["QLD"] = ("Queensland", "昆士兰"), ["NSW"] = ("New South Wales", "新南威尔士"), ["VIC"] = ("Victoria", "维多利亚"), ["TAS"] = ("Tasmania", "塔斯马尼亚"), ["ACT"] = ("Australian Capital Territory", "首都领地") };
    public static bool ValidYear(string s) => Regex.IsMatch(s, @"^\d{4}-\d{2}$") && (int.Parse(s[..4]) + 1) % 100 == int.Parse(s[^2..]);
    public static string Hash(string s) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(s)));
    public static string Id(string s) => new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(s)).AsSpan(0, 16)).ToString();
    public static string Normalize(string s) => Regex.Replace(s.ToLowerInvariant(), @"[\s\p{P}\p{S}]", "");
    public static void ScopeAllowed(string visa, string sponsorship) { if (visa is not ("190" or "491") || sponsorship != "state") throw new ApiFailure(400, "INVALID_STATE_SCOPE", "Only 190 and state-nominated 491 belong in this panel."); }
    public static void ValueAllowed(string metric, decimal? value, string status, string? reason) { if (metric is not ("nomination_allocation" or "nomination_invitation_count" or "visa_invitation_count" or "eoi_stock_count" or "last_invited_eoi_points")) throw new InvalidOperationException("Unknown metric"); if (status is not ("available" or "not_published" or "not_ingested" or "suppressed" or "not_applicable" or "parse_failed" or "source_unavailable")) throw new InvalidOperationException("Unknown status"); if (status == "available" ? (value is null || reason is not null) : (value is not null || string.IsNullOrWhiteSpace(reason))) throw new InvalidOperationException("Value and missing reason do not match availability"); if (value < 0 || (metric != "last_invited_eoi_points" && value is not null && decimal.Truncate(value.Value) != value) || metric == "last_invited_eoi_points" && value > 200) throw new InvalidOperationException("Invalid value"); }
}
