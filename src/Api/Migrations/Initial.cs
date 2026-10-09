using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace Atlas.Migrations;

[DbContext(typeof(AtlasDb))]
[Migration("202610080001_Initial")]
public class Initial : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "schema.sql")));
    protected override void Down(MigrationBuilder m) => throw new NotSupportedException("Evidence requires an explicitly reviewed forward migration.");
}
