using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
namespace Atlas;

public class AtlasDb(DbContextOptions<AtlasDb> options) : DbContext(options);
public class ReaderInterceptor : DbConnectionInterceptor
{
    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData data, CancellationToken ct = default) { await using var command = connection.CreateCommand(); command.CommandText = "SET ROLE atlas_reader; SET default_transaction_read_only=on"; await command.ExecuteNonQueryAsync(ct); }
}
