import { supabase } from './supabaseClient.js';

// ─── Default Seed Data ────────────────────────────────────────────────────────
export function getDefaultProjects() {
    return [
        { name: "Donut", description: "3D Animation", images: ["portfolio/donut/donut.png"], mainImage: "portfolio/donut/donut.png" },
        { name: "Duvar Takvimi", description: "Print Design", images: ["portfolio/duvartakvimi/4729b6ca-1.png"], mainImage: "portfolio/duvartakvimi/4729b6ca-1.png" },
        { name: "Godfather", description: "Poster Design", images: ["portfolio/godfather/afb2827e-1.png"], mainImage: "portfolio/godfather/afb2827e-1.png" }
    ];
}

export function getDefaultProfile() {
    return {
        name: "New Profile",
        title: "Designer",
        tagline: "I create things",
        about: "Hello! Edit your profile here.",
        skills: ["Design", "Code"],
        email: "contact@example.com"
    };
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export async function getProfile(username = null) {
    // If username is provided, query by username (for public site)
    if (username) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) return getDefaultProfile();
        return data;
    }

    // Otherwise, getting for Admin (authenticated user)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return getDefaultProfile();

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    return data || getDefaultProfile();
}

export async function saveProfile(profileData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', session.user.id);

    if (error) throw new Error(error.message);
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function getProjects(username = null) {
    let userId;

    if (username) {
        // Public lookup: get user_id from profiles first
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();
        if (!profile) return [];
        userId = profile.id;
    } else {
        // Auth lookup
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        userId = session.user.id;
    }

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('order_index', { ascending: true }); // Admin dragging order

    if (error) {
        console.error("Error fetching projects:", error);
        return [];
    }

    // Map DB schema to frontend expected schema
    return data.map(dbProj => ({
        id: dbProj.id,
        name: dbProj.name,
        description: dbProj.description,
        mainImage: dbProj.main_image,
        images: dbProj.images || [],
        order_index: dbProj.order_index
    }));
}

export async function addProject(project) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    // Get current projects to append accurately
    const current = await getProjects();
    const nextOrder = current.length > 0 ? (current[current.length - 1].order_index + 1) : 0;

    const { data, error } = await supabase
        .from('projects')
        .insert([{
            user_id: session.user.id,
            name: project.name,
            description: project.description,
            main_image: project.mainImage || (project.images ? project.images[0] : null),
            images: project.images || [],
            order_index: nextOrder
        }])
        .select();

    if (error) console.error(error);
    return data ? data[0] : null;
}

export async function updateProject(id, updates) {
    // translate camelCase to snake_case for db
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.mainImage !== undefined) dbUpdates.main_image = updates.mainImage;
    if (updates.images !== undefined) dbUpdates.images = updates.images;

    const { data, error } = await supabase
        .from('projects')
        .update(dbUpdates)
        .eq('id', id)
        .select();

    return data ? data[0] : null;
}

export async function deleteProject(id) {
    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
    if (error) console.error(error);
}

export async function reorderProjects(sourceIndex, targetIndex) {
    let projects = await getProjects();
    if (sourceIndex < 0 || sourceIndex >= projects.length || targetIndex < 0 || targetIndex >= projects.length) return;

    const [movedItem] = projects.splice(sourceIndex, 1);
    projects.splice(targetIndex, 0, movedItem);

    // Re-assign sequential order indexes and batch update
    // Supabase JS doesn't have a single batch-update array logic that is easy without rpc,
    // so we'll construct multiple update promises
    const updates = projects.map((p, newIdx) =>
        supabase.from('projects').update({ order_index: newIdx }).eq('id', p.id)
    );

    await Promise.all(updates);
}

export async function uploadImages(files) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${session.user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('portfolio-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('portfolio-images')
            .getPublicUrl(filePath);

        return data.publicUrl;
    });

    return await Promise.all(uploadPromises);
}

export async function addImagesToProject(projectId, urls) {
    let projects = await getProjects();
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;

    let images = proj.images || [];
    images.push(...urls);

    let mainImage = proj.mainImage || urls[0]; // Set first as main if none exists

    await updateProject(projectId, { images, mainImage });
}

export async function removeImageFromProject(projectId, url) {
    let projects = await getProjects();
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;

    let images = (proj.images || []).filter(img => img !== url);
    let mainImage = proj.mainImage;
    if (mainImage === url) {
        mainImage = images[0] || "";
    }

    await updateProject(projectId, { images, mainImage });
}

export async function setMainImage(projectId, url) {
    await updateProject(projectId, { mainImage: url });
}
