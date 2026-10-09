using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace Atlas.Migrations;
[DbContext(typeof(AtlasDb))]
[Migration("202610090001_OfficialHistory")]
public class OfficialHistoryMigration : Migration
{
 protected override void Up(MigrationBuilder m) => m.Sql(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"official-schema.sql")));
 protected override void Down(MigrationBuilder m) => throw new NotSupportedException("Published official history requires a reviewed forward migration.");
}
