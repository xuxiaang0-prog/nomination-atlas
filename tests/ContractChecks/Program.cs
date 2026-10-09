using Atlas;
using System.Text.Json;
int count=0;
void Check(string name,Action assertion){assertion();count++;Console.WriteLine("PASS C# "+name);}
void Expect(bool value){if(!value)throw new Exception("Assertion failed");}
void Reject(Action a){try{a();}catch(Exception){return;}throw new Exception("Expected rejection");}
foreach(var year in new[]{"2025-26","2026-27","2099-00"})Check("valid program year "+year,()=>Expect(Rules.ValidYear(year)));
foreach(var year in new[]{"2025-27","2025/26","25-26","2025-2026","abcd-ef"})Check("invalid program year "+year,()=>Expect(!Rules.ValidYear(year)));
Check("8 distinct jurisdictions",()=>Expect(Rules.StateCodes.Distinct().Count()==8));
Check("Unicode search normalization",()=>Expect(Rules.Normalize(" Software-Engineer ")=="softwareengineer"&&Rules.Normalize("软件 工程师")=="软件工程师"));
Check("stable UUID identity",()=>Expect(Rules.Id("fact")==Rules.Id("fact")&&Guid.TryParse(Rules.Id("fact"),out _)));
Check("SHA-256 known vector",()=>Expect(Rules.Hash("abc")=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
Check("state 190 allowed",()=>Rules.ScopeAllowed("190","state"));
Check("state 491 allowed",()=>Rules.ScopeAllowed("491","state"));
Check("family 491 excluded",()=>Reject(()=>Rules.ScopeAllowed("491","family")));
Check("189 excluded",()=>Reject(()=>Rules.ScopeAllowed("189","state")));
Check("zero can be an observed value",()=>Rules.ValueAllowed("nomination_allocation",0,"available",null));
Check("missing is null plus reason",()=>Rules.ValueAllowed("nomination_allocation",null,"not_published","not stated"));
Check("suppressed remains unknown",()=>Rules.ValueAllowed("nomination_invitation_count",null,"suppressed","small sample"));
Check("missing cannot be zero",()=>Reject(()=>Rules.ValueAllowed("nomination_allocation",0,"not_published","missing")));
Check("count cannot be fractional",()=>Reject(()=>Rules.ValueAllowed("nomination_allocation",1.5m,"available",null)));
Check("negative value excluded",()=>Reject(()=>Rules.ValueAllowed("last_invited_eoi_points",-1,"available",null)));
Check("points have bounded value",()=>Reject(()=>Rules.ValueAllowed("last_invited_eoi_points",201,"available",null)));
Check("unknown metric excluded",()=>Reject(()=>Rules.ValueAllowed("grant_count",1,"available",null)));
Check("JSON retains missing and demo metadata",()=>{var json=JsonSerializer.Serialize(new Envelope<AnswerData>(new("template","no data",[],[],["historicalEvidence"]),new("demo-v1",true,"2026-10-08","partial","separate metrics"),[],[]),new JsonSerializerOptions(JsonSerializerDefaults.Web));Expect(json.Contains("\"isDemo\":true")&&json.Contains("\"missingInputs\":[\"historicalEvidence\"]"));});
Console.WriteLine($"{count} C# checks passed");
