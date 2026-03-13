import { supabase } from './supabaseClient.js';

const STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/portfolio-images/`;

/**
 * Helper to ensure a URL is absolute. If it's a relative path, prepends Supabase storage base.
 */
export function ensureAbsoluteUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    // Clean leading slash if any
    const path = url.startsWith('/') ? url.substring(1) : url;
    return STORAGE_BASE + path;
}

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
export async function getProfile(username = null, userId = null) {
    // 1. If Full ID is provided (Precise UUID lookup)
    if (userId && userId.length > 20) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            if (!error && data) {
                if (data.avatar_url) data.avatar_url = ensureAbsoluteUrl(data.avatar_url);
                return data;
            }
        } catch (e) {
            console.warn("Full ID lookup failed:", e);
        }
    }

    // 2. If Username is provided
    if (username && username !== 'user') {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', username)
                .maybeSingle();
            if (!error && data) {
                if (data.avatar_url) data.avatar_url = ensureAbsoluteUrl(data.avatar_url);
                return data;
            }
        } catch (e) {
            console.warn("Username lookup failed:", e);
        }
    }

    // 3. Last resort: getting for Admin (authenticated user)
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
            if (!error && data) {
                if (data.avatar_url) data.avatar_url = ensureAbsoluteUrl(data.avatar_url);
                return data;
            }
        }
    } catch (e) {
        console.warn("Session lookup failed:", e);
    }

    return getDefaultProfile();
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

export async function isUsernameAvailable(username, userId) {
    // Usernames are now allowed to be duplicates as access is via UUID.
    return true;
}

// ─── Projects ─────────────────────────────────────────────────────────────────
/**
 * Fetches projects for a given user.
 */
export async function getProjects(username = null, userId = null) {
    let targetUserId = userId;

    if (!targetUserId) {
        // Auth lookup
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        targetUserId = session.user.id;
    }

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', targetUserId)
        .order('order_index', { ascending: true });

    if (error) return [];

    return data.map(dbProj => ({
        id: dbProj.id,
        name: dbProj.name,
        description: dbProj.description,
        mainImage: ensureAbsoluteUrl(dbProj.main_image),
        images: (dbProj.images || []).map(img => ensureAbsoluteUrl(img)),
        order_index: dbProj.order_index
    }));
}

/**
 * Fetches a single project by ID for a specific user.
 */
export async function getProject(userId, projectId) {
    if (!projectId) return null;

    let query = supabase.from('projects').select('*').eq('id', projectId);
    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    return {
        id: data.id,
        name: data.name,
        description: data.description,
        mainImage: ensureAbsoluteUrl(data.main_image),
        images: (data.images || []).map(img => ensureAbsoluteUrl(img)),
        order_index: data.order_index
    };
}

/**
 * Generates an optimized image URL using Supabase image transformation.
 * Returns the original URL if transformation is not possible or if it's not a Supabase storage URL.
 */
export function getOptimizedImageUrl(url, options = { width: 800, quality: 80, format: 'webp' }) {
    if (!url || typeof url !== 'string' || !url.includes('supabase.co')) return url;

    // Check if image transformation is disabled via global variable or if we want to be safe
    if (window.disableImageOptimization) return url;

    try {
        const urlObj = new URL(url);
        // Supabase Image Transformation format requires /storage/v1/render/image/public/
        // Only attempt for known public storage objects
        if (urlObj.pathname.includes('/storage/v1/object/public/')) {
            const transformedPath = urlObj.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');

            const params = new URLSearchParams();
            if (options.width) params.set('width', options.width);
            if (options.quality) params.set('quality', options.quality);
            if (options.format) params.set('format', options.format);
            if (options.resize) params.set('resize', options.resize || 'cover');

            return `${urlObj.origin}${transformedPath}?${params.toString()}`;
        }
    } catch (e) {
        console.warn("Optimized URL generation failed, falling back to original:", e);
    }
    return url;
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

    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
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

/**
 * Helper to get the 6-character short ID from a full UUID
 */
export function getShortId(uid) {
    if (!uid) return "";
    return uid.substring(0, 6);
}

/**
 * Generates a hybrid shareable URL
 */
export function getHybridUrl(profile) {
    if (!profile || !profile.id) return window.location.origin + "/";
    const shortId = getShortId(profile.id);
    const username = profile.username || "user";
    return `${window.location.origin}/${shortId}/${username}`;
}
