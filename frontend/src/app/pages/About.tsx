export function About() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="text-center mb-12">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <img className="w-24 h-24 rounded-lg object-cover" alt="Sarab logo" src="/favicon.png"/>
          </div>
          <h2 className="mb-3" style={{ fontSize: '2rem', color: '#9481ff' }}>Sarab</h2>
          <p className="text-xl text-muted-foreground">Ophthalmology Research Database</p>
        </div>

        <div className="space-y-8">
          <div className="border border-border rounded-lg bg-card p-8">
            <h3 className="mb-4">About Sarab</h3>
            <p className="text-muted-foreground mb-4">
              Sarab (meaning "mirage" in Arabic) is a comprehensive ophthalmology research database designed to facilitate
              collaboration between researchers and medical professionals. Our platform enables contributors to upload clinical
              samples and imaging data, which researchers can then access for their studies.
            </p>
            <p className="text-muted-foreground">
              The database supports various types of ophthalmological imaging including retinal scans, OCT scans, slit lamp
              photography, and corneal topography maps. Each sample includes detailed metadata and clinical information to
              support meaningful research outcomes.
            </p>
          </div>

          <div className="border border-border rounded-lg bg-card p-8">
            <h3 className="mb-4">User Roles</h3>
            <div className="space-y-4">
              <div>
                <h4 className="mb-2" style={{ color: '#9481ff' }}>Researchers</h4>
                <p className="text-sm text-muted-foreground">
                  Access and search the database for clinical samples. Download imaging data and associated metadata
                  for research purposes.
                </p>
              </div>
              <div>
                <h4 className="mb-2" style={{ color: '#9481ff' }}>Contributors</h4>
                <p className="text-sm text-muted-foreground">
                  Upload clinical samples with imaging data and comprehensive metadata. Organize samples into collections
                  and folders. Track views and downloads of contributed samples.
                </p>
              </div>
              <div>
                <h4 className="mb-2" style={{ color: '#9481ff' }}>Administrators</h4>
                <p className="text-sm text-muted-foreground">
                  Manage user accounts and permissions. Oversee collections and data organization. Monitor platform
                  activity and maintain data quality standards.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-8">
            <h3 className="mb-4">Key Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span style={{ color: '#9481ff' }}>•</span>
                <span>Advanced search and filtering by condition, tags, and metadata</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#9481ff' }}>•</span>
                <span>Hierarchical organization with collections and folders</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#9481ff' }}>•</span>
                <span>Comprehensive clinical metadata for each sample</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#9481ff' }}>•</span>
                <span>Support for multiple file types including images, videos, and documents</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#9481ff' }}>•</span>
                <span>Access control and privacy management</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#9481ff' }}>•</span>
                <span>Usage tracking and analytics for contributors</span>
              </li>
            </ul>
          </div>

          <div className="border border-border rounded-lg bg-card p-8">
            <h3 className="mb-4">Contact & Support</h3>
            <p className="text-sm text-muted-foreground mb-4">
              For questions, technical support, or to request access to the platform, please contact:
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span> support@sarab-db.org
              </div>
              <div>
                <span className="text-muted-foreground">Documentation:</span> docs.sarab-db.org
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
