using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
namespace Atlas;

public record HistoryData(string DatasetVersion, string CreatedAt, IReadOnlyList<JsonElement> Records, IReadOnlyList<JsonElement> Sources, IReadOnlyList<JsonElement> Coverage, IReadOnlyList<string> Methodology, JsonElement Stats, IReadOnlyList<JsonElement> Nominations, IReadOnlyList<JsonElement> Guides, JsonElement? RecentActivity);
public static class OfficialHistory
{
 static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
 public static async Task Import(AtlasDb db,string root)
 {
  var path=Path.Combine(root,"official/history.json");
  if(!File.Exists(path)) throw new InvalidOperationException("Official history manifest is missing");
  var bytes=await File.ReadAllBytesAsync(path);var hash=Convert.ToHexStringLower(SHA256.HashData(bytes));
  using var document=JsonDocument.Parse(bytes);var pack=document.RootElement;
  var key=pack.GetProperty("datasetVersion").GetString()!;
  var existing=await db.Database.SqlQueryRaw<string>("SELECT content_hash AS \"Value\" FROM official_release WHERE key={0}",key).ToListAsync();
  if(existing.Count>0){if(existing[0]!=hash)throw new InvalidOperationException("An existing release has different content; publish a new version");return;}
  var sources=pack.GetProperty("sources").EnumerateArray().ToArray();
  foreach(var source in sources)
  {
   var relative=source.GetProperty("localPath").GetString()!;
   var full=Path.GetFullPath(Path.Combine(root,relative));
   if(!full.StartsWith(Path.GetFullPath(root)+Path.DirectorySeparatorChar))throw new InvalidOperationException("Source path escapes data root");
   var raw=await File.ReadAllBytesAsync(full);
   if(Convert.ToHexStringLower(SHA256.HashData(raw))!=source.GetProperty("sha256").GetString())throw new InvalidOperationException("Official source snapshot hash mismatch: "+relative);
  }
  var records=pack.GetProperty("records").EnumerateArray().ToArray();
  if(records.Select(x=>x.GetProperty("id").GetString()).Distinct().Count()!=records.Length)throw new InvalidOperationException("Duplicate official evidence IDs");
  foreach(var row in records)
  {
   if(row.GetProperty("points").ValueKind!=JsonValueKind.Null && row.GetProperty("pointsStatus").GetString()!="published")throw new InvalidOperationException("Invalid points status");
   if(row.GetProperty("invitationCount").ValueKind!=JsonValueKind.Null && row.GetProperty("countStatus").GetString() is not ("published" or "source_conflict"))throw new InvalidOperationException("Invalid count status");
   if(row.GetProperty("occupationLevel").GetString()=="occupation" && row.GetProperty("countScope").GetString() is "state_round_total" or "pathway_total" or "stream_subclass_month")throw new InvalidOperationException("Aggregate invitations cannot be assigned to one occupation");
  }
  var nominations=pack.TryGetProperty("nominations",out var nominationsJson) ? nominationsJson.EnumerateArray().ToArray() : Array.Empty<JsonElement>();
  foreach(var row in nominations)
  {
   if(!Rules.Names.ContainsKey(row.GetProperty("state").GetString()!) || row.GetProperty("metric").GetString()!="state_territory_nominations")throw new InvalidOperationException("Invalid nomination scope");
   if(!sources.Any(s=>s.GetProperty("id").GetString()==row.GetProperty("sourceId").GetString() && s.GetProperty("sha256").GetString()==row.GetProperty("sourceSha256").GetString()))throw new InvalidOperationException("Nomination source not archived");
   foreach(var visa in new[]{"190","491"})
   {
    var value=row.GetProperty("nomination"+visa);var status=row.GetProperty("countStatus"+visa).GetString();
    if(status=="suppressed_below_5" && value.ValueKind!=JsonValueKind.Null)throw new InvalidOperationException("Suppressed count must remain null");
    if(status=="reported" && (!value.TryGetInt64(out var count)||count<0))throw new InvalidOperationException("Published count must be a nonnegative integer");
    if(status is not ("reported" or "suppressed_below_5"))throw new InvalidOperationException("Unknown nomination count status");
   }
  }
  var guides=pack.TryGetProperty("guides",out var guidesJson) ? guidesJson.EnumerateArray().ToArray() : Array.Empty<JsonElement>();
  JsonElement? recentActivity=pack.TryGetProperty("recentActivity",out var activityJson) ? activityJson : null;
  if(recentActivity is { } activity)
  {
   var datasets=activity.GetProperty("datasets").EnumerateArray().ToArray();
   if(datasets.Select(x=>x.GetProperty("id").GetString()).Distinct().Count()!=datasets.Length)throw new InvalidOperationException("Duplicate recent activity datasets");
   foreach(var set in datasets)
   {
    if(set.GetProperty("metric").GetString() is not ("visa_lodged_primary" or "visa_granted_primary" or "eoi_invited_snapshot" or "eoi_submitted_snapshot"))throw new InvalidOperationException("Unknown recent activity metric");
    if(!sources.Any(s=>s.GetProperty("id").GetString()==set.GetProperty("sourceId").GetString()))throw new InvalidOperationException("Recent activity source not archived");
   }
   var activityRows=activity.GetProperty("records").EnumerateArray().ToArray();
   if(activityRows.Select(x=>x.GetProperty("id").GetString()).Distinct().Count()!=activityRows.Length)throw new InvalidOperationException("Duplicate recent activity records");
   foreach(var row in activityRows)
   {
    if(!Rules.Names.ContainsKey(row.GetProperty("state").GetString()!) || row.GetProperty("visaSubclass").GetString() is not ("190" or "491"))throw new InvalidOperationException("Invalid recent activity scope");
    if(!datasets.Any(d=>d.GetProperty("id").GetString()==row.GetProperty("datasetId").GetString() && d.GetProperty("sourceId").GetString()==row.GetProperty("sourceId").GetString()))throw new InvalidOperationException("Recent activity dataset/source mismatch");
    var status=row.GetProperty("countStatus").GetString()!;var value=row.GetProperty("count");
    if(status.StartsWith("suppressed",StringComparison.Ordinal) && value.ValueKind!=JsonValueKind.Null)throw new InvalidOperationException("Suppressed recent activity must remain null");
    if(status=="published" && (!value.TryGetInt64(out var count)||count<0))throw new InvalidOperationException("Published recent activity count must be nonnegative");
   }
  }
  var metadata=JsonSerializer.Serialize(new {coverage=pack.GetProperty("coverage"),methodology=pack.GetProperty("methodology"),nominations,guides,recentActivity},Json);
  await using var tx=await db.Database.BeginTransactionAsync();
  await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO official_release(key,content_hash,created_at,status,metadata) VALUES({key},{hash},{pack.GetProperty("createdAt").GetString()}::timestamptz,'draft',{metadata}::jsonb)");
  foreach(var source in sources){var id=source.GetProperty("id").GetString()!;var raw=source.GetRawText();await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO official_source(release_id,id,payload) VALUES({key},{id},{raw}::jsonb)");}
  foreach(var row in records){var id=row.GetProperty("id").GetString()!;var source=row.GetProperty("sourceId").GetString()!;var raw=row.GetRawText();await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO official_history(release_id,id,source_id,payload) VALUES({key},{id},{source},{raw}::jsonb)");}
  await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE official_release SET status='published' WHERE key={key}");
  await db.Database.ExecuteSqlRawAsync("GRANT SELECT ON official_release,official_source,official_history TO atlas_reader");
  await tx.CommitAsync();
 }
 public static async Task<HistoryData> Read(Queries q,string mode,string? version)
 {
  if(mode!="verified_historical")throw new ApiFailure(404,"OFFICIAL_MODE_REQUIRED","Official history is available only in real-data mode");
  var keys=await q.Read<List<string>>("SELECT COALESCE(jsonb_agg(key ORDER BY created_at DESC),'[]'::jsonb)::text AS \"Value\" FROM official_release WHERE status='published' AND ({0}::text IS NULL OR key={0})",version);
  if(keys.Count==0)throw new ApiFailure(404,"HISTORY_VERSION_NOT_FOUND","Requested official history release was not found");
  var key=keys[0];
  return await q.Read<HistoryData>("SELECT jsonb_build_object('datasetVersion',r.key,'createdAt',r.created_at,'records',(SELECT COALESCE(jsonb_agg(h.payload ORDER BY h.payload->>'state',COALESCE(h.payload->>'roundDate',h.payload->>'roundMonth') DESC,h.id),'[]'::jsonb) FROM official_history h WHERE h.release_id=r.key),'sources',(SELECT jsonb_agg(s.payload ORDER BY s.id) FROM official_source s WHERE s.release_id=r.key),'nominations',COALESCE(r.metadata->'nominations','[]'::jsonb),'guides',COALESCE(r.metadata->'guides','[]'::jsonb),'recentActivity',r.metadata->'recentActivity','coverage',r.metadata->'coverage','methodology',r.metadata->'methodology','stats',(SELECT jsonb_build_object('records',count(*),'scores',count(*) FILTER(WHERE payload->'points'<>'null'::jsonb),'invitationCounts',count(*) FILTER(WHERE payload->>'countStatus'='published' AND payload->'invitationCount'<>'null'::jsonb),'sources',(SELECT count(*) FROM official_source WHERE release_id=r.key),'statesWithHistory',count(DISTINCT payload->>'state')) FROM official_history WHERE release_id=r.key))::text AS \"Value\" FROM official_release r WHERE r.key={0}",key);
 }
}
