export default function ProfilePanel({ user, onSignOut }) {
  return (
    <div className="panel-form profile-panel-form">
      <div className="profile-avatar">★</div>
      <p className="profile-email">{user?.email}</p>
      <p className="profile-hint">Your footprints are synced to the cloud.</p>
      <button type="button" onClick={onSignOut}>
        LOGOUT
      </button>
    </div>
  );
}
