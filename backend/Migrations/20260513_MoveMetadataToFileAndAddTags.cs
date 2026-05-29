using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SarabPlatform.Migrations
{
    /// <inheritdoc />
    public partial class MoveMetadataToFileAndAddTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add Metadata column to ResourceFile (Files table)
            migrationBuilder.AddColumn<string>(
                name: "Metadata",
                table: "Files",
                type: "nvarchar(max)",
                nullable: true);

            // Remove Metadata column from Sample table
            migrationBuilder.DropColumn(
                name: "Metadata",
                table: "Samples");

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
            // Add back Metadata column to Sample
            migrationBuilder.AddColumn<string>(
                name: "Metadata",
                table: "Samples",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}");

            // Migrate data back: copy metadata from first file to Sample
            migrationBuilder.Sql(
                @"UPDATE s SET s.Metadata = f.Metadata
                  FROM Samples s
                  INNER JOIN Files f ON s.Id = f.SampleId
                  WHERE f.Id = (SELECT MIN(Id) FROM Files WHERE SampleId = s.Id)
                  AND f.Metadata IS NOT NULL"
            );

            // Remove Metadata column from ResourceFile
            migrationBuilder.DropColumn(
                name: "Metadata",
                table: "Files");
        }
    }
}
