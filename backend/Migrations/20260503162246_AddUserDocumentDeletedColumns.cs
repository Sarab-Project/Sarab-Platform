using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sarab_Platform.Migrations
{
    public partial class AddUserDocumentDeletedColumns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "UserDocuments",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "UserDocuments",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "UserDocuments");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "UserDocuments");
        }
    }
}
