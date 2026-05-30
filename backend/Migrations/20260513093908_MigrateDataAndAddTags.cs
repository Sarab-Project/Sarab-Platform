using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sarab_Platform.Migrations
{
    /// <inheritdoc />
    public partial class MigrateDataAndAddTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migrate data: copy metadata from Sample to first file of each sample
            migrationBuilder.Sql(
                @"UPDATE f SET f.Metadata = s.Metadata
                  FROM Files f
                  INNER JOIN Samples s ON f.SampleId = s.Id
                  WHERE f.Id = (SELECT MIN(Id) FROM Files WHERE SampleId = s.Id)
                  AND s.Metadata IS NOT NULL"
            );

            // Insert predefined tags if they don't exist
            migrationBuilder.Sql(
                @"IF NOT EXISTS (SELECT 1 FROM Tags WHERE Name = 'Sirius')
                  INSERT INTO Tags (Name) VALUES ('Sirius');
                IF NOT EXISTS (SELECT 1 FROM Tags WHERE Name = 'Slit lamp')
                  INSERT INTO Tags (Name) VALUES ('Slit lamp');
                IF NOT EXISTS (SELECT 1 FROM Tags WHERE Name = 'Cornea')
                  INSERT INTO Tags (Name) VALUES ('Cornea');"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
