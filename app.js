// Firebase SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getAuth,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    GoogleAuthProvider,
    onAuthStateChanged,
    browserLocalPersistence,
    setPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCBTllDaEyIww1R89mbrsYDnBgKEjXX-UI",
    authDomain: "family-recipe-book-6b2b8.firebaseapp.com",
    projectId: "family-recipe-book-6b2b8",
    storageBucket: "family-recipe-book-6b2b8.firebasestorage.app",
    messagingSenderId: "117031612843",
    appId: "1:117031612843:web:c0ea3e5bb884bf9570a2ee",
    measurementId: "G-VY0MJ123FL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// 認証の永続性を設定（ブラウザを閉じても維持）
setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn('Persistence setting failed:', err);
});

// iOSのChromeかどうかを判定
function isIOSChrome() {
    return /CriOS/i.test(navigator.userAgent);
}

// iOSかどうかを判定
function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Recipe App Class
class RecipeApp {
    constructor() {
        this.recipes = [];
        this.currentRecipeId = null;
        this.currentPhotoData = null;
        this.unsubscribe = null;

        // DOM要素
        this.loginScreen = document.getElementById('login-screen');
        this.appContainer = document.getElementById('app-container');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.recipeGrid = document.getElementById('recipe-grid');
        this.recipeCount = document.getElementById('recipe-count');
        this.cookedCount = document.getElementById('cooked-count');
        this.sortBy = document.getElementById('sort-by');
        this.filterCategory = document.getElementById('filter-category');

        // モーダル
        this.addModal = document.getElementById('add-modal');
        this.detailModal = document.getElementById('detail-modal');

        // フォーム
        this.recipeForm = document.getElementById('recipe-form');
        this.categorySelect = document.getElementById('recipe-category-select');
        this.categoryNewInput = document.getElementById('recipe-category-new');

        this.init();
    }

    init() {
        this.setupAuthListeners();
        this.setupEventListeners();
    }

    // 認証リスナー
    setupAuthListeners() {
        // ログインボタン
        document.getElementById('google-login-btn').addEventListener('click', () => this.login());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // 認証状態の監視（リダイレクト結果より先に設定）
        onAuthStateChanged(auth, (user) => {
            this.hideLoading();
            if (user) {
                console.log('User logged in:', user.email);
                this.showApp(user);
                this.subscribeToRecipes();
            } else {
                console.log('User not logged in');
                this.showLogin();
            }
        });

        // リダイレクト結果を確認（モバイル対応）
        this.checkRedirectResult();
    }

    // リダイレクト結果を確認
    async checkRedirectResult() {
        try {
            // 認証待ちフラグがある場合のみローディングを表示
            const authPending = sessionStorage.getItem('auth_pending');
            if (authPending) {
                this.showLoading();
                console.log('Auth pending flag found, checking redirect result...');
            }

            const result = await getRedirectResult(auth);
            if (result && result.user) {
                console.log('Redirect login successful:', result.user.email);
                sessionStorage.removeItem('auth_pending');
            } else if (authPending) {
                // リダイレクト結果がないが認証待ちフラグがある場合
                console.log('No redirect result but auth was pending');
                // onAuthStateChangedで処理されるので、ここでは何もしない
            }
        } catch (error) {
            console.error('Redirect result error:', error);
            sessionStorage.removeItem('auth_pending');

            if (error.code === 'auth/popup-closed-by-user') {
                console.log('User closed the popup');
            } else if (error.code === 'auth/cancelled-popup-request') {
                console.log('Popup request cancelled');
            } else if (error.code === 'auth/missing-initial-state') {
                // iOSのChromeでよく発生するエラー
                console.log('Missing initial state - common on iOS Chrome');
                // このエラーは無視して、onAuthStateChangedに任せる
            } else {
                console.error('Auth error details:', error.code, error.message);
                // ユーザーへの通知は最小限に
            }
        } finally {
            this.hideLoading();
        }
    }

    // モバイル判定
    isMobile() {
        return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    }

    // PWA（スタンドアロンモード）判定
    isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    async login() {
        try {
            this.showLoading();

            // iOSのChromeの場合は特別な処理が必要
            // CriOSはポップアップがブロックされやすいため、リダイレクト方式を使用
            if (isIOSChrome()) {
                console.log('iOS Chrome detected, using redirect method');
                // sessionStorageに認証開始フラグを保存
                sessionStorage.setItem('auth_pending', 'true');
                await signInWithRedirect(auth, provider);
                return;
            }

            // その他のブラウザではポップアップを試行
            console.log('Using popup method');
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Login error:', error);
            // ポップアップがブロックされた場合はリダイレクト方式にフォールバック
            if (error.code === 'auth/popup-blocked' ||
                error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request') {
                console.log('Popup failed, trying redirect...');
                try {
                    sessionStorage.setItem('auth_pending', 'true');
                    await signInWithRedirect(auth, provider);
                } catch (redirectError) {
                    console.error('Redirect also failed:', redirectError);
                    alert('ログインに失敗しました。\nSafariでこのページを開いてお試しください。');
                    this.hideLoading();
                }
            } else {
                alert('ログインに失敗しました: ' + error.message);
                this.hideLoading();
            }
        }
    }

    async logout() {
        try {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    showLogin() {
        this.loginScreen.style.display = 'flex';
        this.appContainer.style.display = 'none';
    }

    showApp(user) {
        this.loginScreen.style.display = 'none';
        this.appContainer.style.display = 'block';

        // ユーザー情報を表示
        document.getElementById('user-avatar').src = user.photoURL || '';
        document.getElementById('user-name').textContent = user.displayName || 'ユーザー';
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    // Firestoreからレシピをリアルタイム取得
    subscribeToRecipes() {
        const recipesRef = collection(db, 'recipes');
        const q = query(recipesRef, orderBy('createdAt', 'desc'));

        this.unsubscribe = onSnapshot(q, (snapshot) => {
            this.recipes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.updateCategoryOptions();
            this.renderRecipes();
        });
    }

    setupEventListeners() {
        // 追加モーダル
        document.getElementById('open-add-form').addEventListener('click', () => this.openAddModal());
        document.getElementById('close-add-form').addEventListener('click', () => this.closeAddModal());
        this.addModal.addEventListener('click', (e) => {
            if (e.target === this.addModal) this.closeAddModal();
        });

        // 詳細モーダル
        document.getElementById('close-detail').addEventListener('click', () => this.closeDetailModal());
        this.detailModal.addEventListener('click', (e) => {
            if (e.target === this.detailModal) this.closeDetailModal();
        });

        // レシピ追加フォーム
        this.recipeForm.addEventListener('submit', (e) => this.handleAddRecipe(e));

        // カテゴリ選択
        this.categorySelect.addEventListener('change', () => {
            if (this.categorySelect.value === '__new__') {
                this.categoryNewInput.style.display = 'block';
                this.categoryNewInput.focus();
            } else {
                this.categoryNewInput.style.display = 'none';
                this.categoryNewInput.value = '';
            }
        });

        // ソート・フィルター
        this.sortBy.addEventListener('change', () => this.renderRecipes());
        this.filterCategory.addEventListener('change', () => this.renderRecipes());

        // 詳細モーダル内のイベント
        document.getElementById('detail-cooked-checkbox').addEventListener('change', (e) => {
            this.toggleCooked(this.currentRecipeId, e.target.checked);
        });

        // 調理記録フォーム
        document.getElementById('add-log-btn').addEventListener('click', () => this.showLogForm());
        document.getElementById('cancel-log-btn').addEventListener('click', () => this.hideLogForm());
        document.getElementById('save-log-btn').addEventListener('click', () => this.saveLog());

        // 写真プレビュー
        document.getElementById('log-photo').addEventListener('change', (e) => this.handlePhotoSelect(e));

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAddModal();
                this.closeDetailModal();
            }
        });

        // 編集機能
        document.getElementById('edit-recipe-btn').addEventListener('click', () => this.showEditMode());
        document.getElementById('cancel-edit-btn').addEventListener('click', () => this.hideEditMode());
        document.getElementById('save-edit-btn').addEventListener('click', () => this.saveEdit());

        // 編集フォームのカテゴリ選択
        document.getElementById('edit-recipe-category').addEventListener('change', (e) => {
            const newInput = document.getElementById('edit-recipe-category-new');
            if (e.target.value === '__new__') {
                newInput.style.display = 'block';
                newInput.focus();
            } else {
                newInput.style.display = 'none';
                newInput.value = '';
            }
        });
    }

    // カテゴリ一覧を取得
    getCategories() {
        const categories = new Set();
        this.recipes.forEach(r => {
            if (r.category) categories.add(r.category);
        });
        return Array.from(categories).sort();
    }

    // カテゴリオプションを更新
    updateCategoryOptions() {
        const categories = this.getCategories();

        // フィルター用セレクト
        this.filterCategory.innerHTML = '<option value="all">すべて</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            this.filterCategory.appendChild(option);
        });

        // 追加フォーム用セレクト
        this.categorySelect.innerHTML = '<option value="">選択してください</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            this.categorySelect.appendChild(option);
        });
        // 新規追加オプション
        const newOption = document.createElement('option');
        newOption.value = '__new__';
        newOption.textContent = '+ 新しいカテゴリを追加';
        this.categorySelect.appendChild(newOption);

        // 編集フォーム用セレクト
        const editCategorySelect = document.getElementById('edit-recipe-category');
        editCategorySelect.innerHTML = '<option value="">選択してください</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            editCategorySelect.appendChild(option);
        });
        const editNewOption = document.createElement('option');
        editNewOption.value = '__new__';
        editNewOption.textContent = '+ 新しいカテゴリを追加';
        editCategorySelect.appendChild(editNewOption);
    }

    // モーダル操作
    openAddModal() {
        this.addModal.classList.add('active');
        document.getElementById('recipe-name').focus();
    }

    closeAddModal() {
        this.addModal.classList.remove('active');
        this.recipeForm.reset();
        this.categoryNewInput.style.display = 'none';
        this.categoryNewInput.value = '';
    }

    openDetailModal(recipeId) {
        this.currentRecipeId = recipeId;
        const recipe = this.recipes.find(r => r.id === recipeId);
        if (!recipe) return;

        // 詳細情報を設定
        document.getElementById('detail-title').textContent = recipe.name;
        document.getElementById('detail-author').textContent = recipe.createdByName ? `追加者: ${recipe.createdByName}` : '';
        document.getElementById('detail-url').href = recipe.url;
        document.getElementById('detail-category').textContent = recipe.category || '未分類';
        document.getElementById('detail-cooked-checkbox').checked = recipe.cooked;

        // 評価を描画
        this.renderDetailRating(recipe.rating);

        // 調理記録を描画
        this.renderLogs(recipe);

        // フォームをリセット
        this.hideLogForm();
        this.hideEditMode();

        this.detailModal.classList.add('active');
    }

    closeDetailModal() {
        this.detailModal.classList.remove('active');
        this.currentRecipeId = null;
        this.hideEditMode();
    }

    // 編集モード表示
    showEditMode() {
        const recipe = this.recipes.find(r => r.id === this.currentRecipeId);
        if (!recipe) return;

        // 現在の値をフォームにセット
        document.getElementById('edit-recipe-name').value = recipe.name || '';
        document.getElementById('edit-recipe-url').value = recipe.url || '';

        const categorySelect = document.getElementById('edit-recipe-category');
        const categoryNewInput = document.getElementById('edit-recipe-category-new');

        // カテゴリが既存のものかチェック
        const categories = this.getCategories();
        if (recipe.category && categories.includes(recipe.category)) {
            categorySelect.value = recipe.category;
            categoryNewInput.style.display = 'none';
        } else if (recipe.category) {
            categorySelect.value = '__new__';
            categoryNewInput.value = recipe.category;
            categoryNewInput.style.display = 'block';
        } else {
            categorySelect.value = '';
            categoryNewInput.style.display = 'none';
        }

        // 表示切り替え
        document.getElementById('detail-view-mode').style.display = 'none';
        document.getElementById('detail-edit-mode').style.display = 'block';
    }

    // 編集モード非表示
    hideEditMode() {
        document.getElementById('detail-view-mode').style.display = 'block';
        document.getElementById('detail-edit-mode').style.display = 'none';
        document.getElementById('edit-recipe-category-new').style.display = 'none';
        document.getElementById('edit-recipe-category-new').value = '';
    }

    // 編集内容を保存
    async saveEdit() {
        const recipe = this.recipes.find(r => r.id === this.currentRecipeId);
        if (!recipe) return;

        const name = document.getElementById('edit-recipe-name').value.trim();
        const url = document.getElementById('edit-recipe-url').value.trim();

        const categorySelect = document.getElementById('edit-recipe-category');
        const categoryNewInput = document.getElementById('edit-recipe-category-new');
        let category = categorySelect.value === '__new__'
            ? categoryNewInput.value.trim()
            : categorySelect.value;
        category = category || null;

        if (!name || !url) {
            alert('レシピ名とURLは必須です');
            return;
        }

        try {
            this.showLoading();
            await updateDoc(doc(db, 'recipes', this.currentRecipeId), {
                name: name,
                url: url,
                category: category
            });

            // 表示を更新
            document.getElementById('detail-title').textContent = name;
            document.getElementById('detail-url').href = url;
            document.getElementById('detail-category').textContent = category || '未分類';

            this.hideEditMode();
        } catch (error) {
            console.error('Error updating recipe:', error);
            alert('更新に失敗しました');
        } finally {
            this.hideLoading();
        }
    }

    // 詳細モーダルの評価を描画
    renderDetailRating(currentRating) {
        const container = document.getElementById('detail-rating');
        container.innerHTML = '';

        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = 'star' + (i <= currentRating ? ' active' : '');
            star.textContent = '★';

            star.addEventListener('click', () => {
                this.setRating(this.currentRecipeId, i);
                this.renderDetailRating(i);
            });

            star.addEventListener('mouseenter', () => {
                container.querySelectorAll('.star').forEach((s, index) => {
                    s.style.color = index < i ? '#ffc107' : '#ddd';
                });
            });

            star.addEventListener('mouseleave', () => {
                container.querySelectorAll('.star').forEach((s, index) => {
                    const recipe = this.recipes.find(r => r.id === this.currentRecipeId);
                    s.style.color = index < (recipe?.rating || 0) ? '#ffc107' : '#ddd';
                });
            });

            container.appendChild(star);
        }
    }

    // カテゴリを取得（選択または新規入力）
    getSelectedCategory() {
        const selectValue = this.categorySelect.value;
        if (selectValue === '__new__') {
            return this.categoryNewInput.value.trim() || null;
        }
        return selectValue || null;
    }

    // レシピ追加
    async handleAddRecipe(e) {
        e.preventDefault();

        const recipe = {
            name: document.getElementById('recipe-name').value.trim(),
            url: document.getElementById('recipe-url').value.trim(),
            category: this.getSelectedCategory(),
            cooked: false,
            rating: 0,
            logs: [],
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.uid,
            createdByName: auth.currentUser.displayName
        };

        try {
            this.showLoading();
            await addDoc(collection(db, 'recipes'), recipe);
            this.closeAddModal();
        } catch (error) {
            console.error('Error adding recipe:', error);
            alert('レシピの追加に失敗しました');
        } finally {
            this.hideLoading();
        }
    }

    // レシピ削除
    async deleteRecipe(id, event) {
        event.stopPropagation();
        if (!confirm('このレシピを削除しますか？')) return;

        try {
            this.showLoading();
            await deleteDoc(doc(db, 'recipes', id));
        } catch (error) {
            console.error('Error deleting recipe:', error);
            alert('削除に失敗しました');
        } finally {
            this.hideLoading();
        }
    }

    // 調理済みステータスの切り替え
    async toggleCooked(id, value) {
        try {
            await updateDoc(doc(db, 'recipes', id), { cooked: value });
        } catch (error) {
            console.error('Error updating cooked status:', error);
        }
    }

    // 評価の設定
    async setRating(id, rating) {
        try {
            await updateDoc(doc(db, 'recipes', id), { rating: rating });
        } catch (error) {
            console.error('Error updating rating:', error);
        }
    }

    // 調理記録フォームの表示/非表示
    showLogForm() {
        const container = document.getElementById('log-form-container');
        container.style.display = 'block';
        document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('log-note').value = '';
        document.getElementById('log-photo').value = '';
        document.getElementById('photo-preview').innerHTML = '';
        this.currentPhotoData = null;
    }

    hideLogForm() {
        document.getElementById('log-form-container').style.display = 'none';
        this.currentPhotoData = null;
    }

    // 写真選択処理（圧縮付き）
    handlePhotoSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            // 画像を圧縮
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 800;
                let width = img.width;
                let height = img.height;

                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                this.currentPhotoData = canvas.toDataURL('image/jpeg', 0.7);
                document.getElementById('photo-preview').innerHTML =
                    `<img src="${this.currentPhotoData}" alt="プレビュー">`;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    // 調理記録を保存
    async saveLog() {
        const recipe = this.recipes.find(r => r.id === this.currentRecipeId);
        if (!recipe) return;

        const log = {
            id: Date.now(),
            date: document.getElementById('log-date').value,
            note: document.getElementById('log-note').value.trim(),
            photo: this.currentPhotoData,
            createdBy: auth.currentUser.displayName
        };

        const logs = recipe.logs || [];
        logs.unshift(log);

        try {
            this.showLoading();
            await updateDoc(doc(db, 'recipes', this.currentRecipeId), {
                logs: logs,
                cooked: true
            });
            document.getElementById('detail-cooked-checkbox').checked = true;
            this.hideLogForm();
        } catch (error) {
            console.error('Error saving log:', error);
            alert('記録の保存に失敗しました');
        } finally {
            this.hideLoading();
        }
    }

    // 調理記録の削除
    async deleteLog(logId) {
        if (!confirm('この記録を削除しますか？')) return;

        const recipe = this.recipes.find(r => r.id === this.currentRecipeId);
        if (!recipe) return;

        const logs = (recipe.logs || []).filter(l => l.id !== logId);

        try {
            this.showLoading();
            await updateDoc(doc(db, 'recipes', this.currentRecipeId), { logs: logs });
        } catch (error) {
            console.error('Error deleting log:', error);
            alert('削除に失敗しました');
        } finally {
            this.hideLoading();
        }
    }

    // 調理記録一覧を描画
    renderLogs(recipe) {
        const container = document.getElementById('log-list');

        if (!recipe.logs || recipe.logs.length === 0) {
            container.innerHTML = '<p class="empty-log-message">まだ調理記録がありません</p>';
            return;
        }

        container.innerHTML = recipe.logs.map(log => `
            <div class="log-entry">
                <div class="log-entry-header">
                    <span class="log-entry-date">${this.formatDate(log.date)}</span>
                    <span class="log-entry-author">${log.createdBy || ''}</span>
                    <button class="log-delete-btn" data-log-id="${log.id}">×</button>
                </div>
                ${log.photo ? `
                    <div class="log-entry-photo">
                        <img src="${log.photo}" alt="調理写真" data-photo="${log.photo}">
                    </div>
                ` : ''}
                ${log.note ? `<div class="log-entry-note">${this.escapeHtml(log.note)}</div>` : ''}
            </div>
        `).join('');

        // 削除ボタンのイベント
        container.querySelectorAll('.log-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteLog(parseInt(btn.dataset.logId));
            });
        });

        // 画像クリックで拡大
        container.querySelectorAll('.log-entry-photo img').forEach(img => {
            img.addEventListener('click', () => {
                this.showLightbox(img.dataset.photo);
            });
        });
    }

    // 画像拡大表示
    showLightbox(src) {
        const lightbox = document.createElement('div');
        lightbox.className = 'image-lightbox';
        lightbox.innerHTML = `<img src="${src}" alt="拡大画像">`;
        lightbox.addEventListener('click', () => lightbox.remove());
        document.body.appendChild(lightbox);
    }

    // ソート処理
    getSortedRecipes() {
        let recipes = [...this.recipes];
        const sortValue = this.sortBy.value;

        switch (sortValue) {
            case 'newest':
                // Already sorted by createdAt desc from Firestore
                break;
            case 'oldest':
                recipes.reverse();
                break;
            case 'name':
                recipes.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
                break;
            case 'rating-high':
                recipes.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case 'rating-low':
                recipes.sort((a, b) => (a.rating || 0) - (b.rating || 0));
                break;
            case 'cooked':
                recipes.sort((a, b) => (b.cooked ? 1 : 0) - (a.cooked ? 1 : 0));
                break;
            case 'not-cooked':
                recipes.sort((a, b) => (a.cooked ? 1 : 0) - (b.cooked ? 1 : 0));
                break;
            case 'category':
                recipes.sort((a, b) => (a.category || 'zzz').localeCompare(b.category || 'zzz', 'ja'));
                break;
        }

        return recipes;
    }

    // フィルター処理
    getFilteredRecipes(recipes) {
        const categoryFilter = this.filterCategory.value;

        if (categoryFilter === 'all') {
            return recipes;
        }

        return recipes.filter(r => r.category === categoryFilter);
    }

    // レシピカードのHTML生成
    createRecipeCard(recipe) {
        const card = document.createElement('div');
        card.className = 'recipe-card' + (recipe.cooked ? ' cooked' : '');

        const stars = '★'.repeat(recipe.rating || 0);
        const emptyStars = '★'.repeat(5 - (recipe.rating || 0));
        const logCount = recipe.logs?.length || 0;

        card.innerHTML = `
            <button class="delete-btn" title="削除">×</button>
            <div class="recipe-card-header">
                <div class="recipe-card-name">${this.escapeHtml(recipe.name)}</div>
                ${recipe.category ? `<span class="recipe-card-category">${this.escapeHtml(recipe.category)}</span>` : ''}
            </div>
            ${recipe.createdByName ? `<div class="recipe-card-author">by ${this.escapeHtml(recipe.createdByName)}</div>` : ''}
            <div class="recipe-card-meta">
                <div class="recipe-card-rating">
                    ${stars}<span class="empty">${emptyStars}</span>
                </div>
                <div class="recipe-card-badges">
                    ${recipe.cooked ? '<span class="badge badge-cooked">作った!</span>' : ''}
                    ${logCount > 0 ? `<span class="badge badge-logs">${logCount}件の記録</span>` : ''}
                </div>
            </div>
        `;

        // カードクリックで詳細を開く
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-btn')) {
                this.openDetailModal(recipe.id);
            }
        });

        // 削除ボタン
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            this.deleteRecipe(recipe.id, e);
        });

        return card;
    }

    // レシピ一覧の描画
    renderRecipes() {
        const sorted = this.getSortedRecipes();
        const filtered = this.getFilteredRecipes(sorted);

        // 統計情報を更新
        const cookedRecipes = this.recipes.filter(r => r.cooked).length;
        this.recipeCount.textContent = `${this.recipes.length}件のレシピ`;
        this.cookedCount.textContent = `（${cookedRecipes}件調理済み）`;

        // グリッドを描画
        this.recipeGrid.innerHTML = '';

        if (filtered.length === 0) {
            this.recipeGrid.innerHTML = '<p class="empty-message">レシピがありません</p>';
            return;
        }

        filtered.forEach(recipe => {
            this.recipeGrid.appendChild(this.createRecipeCard(recipe));
        });
    }

    // ユーティリティ
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    }
}

// アプリの初期化
document.addEventListener('DOMContentLoaded', () => {
    new RecipeApp();
});
