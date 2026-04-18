export async function shareData(data) {
  const response = await fetch("/api/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    throw new Error("Failed to share data");
  }

  return await response.json();
}

export async function getSharedData(id) {
  const response = await fetch(`/api/share/${id}`);

  if (!response.ok) {
    throw new Error("Failed to retrieve shared data");
  }

  return await response.json();
}
