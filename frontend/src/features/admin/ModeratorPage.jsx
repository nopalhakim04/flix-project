function ModeratorPage() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <div style={{ padding: "24px" }}>
      <h1>Dashboard Moderator</h1>
      <p>Halo, {user?.username}</p>
      <p>Role: {user?.role}</p>
    </div>
  );
}

export default ModeratorPage;
