// レシピアプリ メインクラス
class RecipeApp {
    constructor() {
        this.recipes = this.loadRecipes();
        this.currentRecipeId = null;
        this.currentPhotoData = null;

        // DOM要素
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
        this.categoryInput = document.getElementById('recipe-category');
        this.categoryDatalist = document.getElementById('category-list');

        this.init();
    }

    init() {
        // イベントリスナーの設定
        this.setupEventListeners();
        // カテゴリリストの更新
        this.updateCategoryOptions();
        // レシピ一覧の描画
        this.renderRecipes();
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
    }

    // データ管理
    loadRecipes() {
        const data = localStorage.getItem('familyRecipes');
        return data ? JSON.parse(data) : [];
    }

    saveRecipes() {
        localStorage.setItem('familyRecipes', JSON.stringify(this.recipes));
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

        // 入力用datalist
        this.categoryDatalist.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            this.categoryDatalist.appendChild(option);
        });
    }

    // モーダル操作
    openAddModal() {
        this.addModal.classList.add('active');
        document.getElementById('recipe-name').focus();
    }

    closeAddModal() {
        this.addModal.classList.remove('active');
        this.recipeForm.reset();
    }

    openDetailModal(recipeId) {
        this.currentRecipeId = recipeId;
        const recipe = this.recipes.find(r => r.id === recipeId);
        if (!recipe) return;

        // 詳細情報を設定
        document.getElementById('detail-title').textContent = recipe.name;
        document.getElementById('detail-url').href = recipe.url;
        document.getElementById('detail-category').textContent = recipe.category || '未分類';
        document.getElementById('detail-cooked-checkbox').checked = recipe.cooked;

        // 評価を描画
        this.renderDetailRating(recipe.rating);

        // 調理記録を描画
        this.renderLogs(recipe);

        // フォームをリセット
        this.hideLogForm();

        this.detailModal.classList.add('active');
    }

    closeDetailModal() {
        this.detailModal.classList.remove('active');
        this.currentRecipeId = null;
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

    // レシピ追加
    handleAddRecipe(e) {
        e.preventDefault();

        const recipe = {
            id: Date.now(),
            name: document.getElementById('recipe-name').value.trim(),
            url: document.getElementById('recipe-url').value.trim(),
            category: document.getElementById('recipe-category').value.trim() || null,
            cooked: false,
            rating: 0,
            logs: [],
            createdAt: new Date().toISOString()
        };

        this.recipes.unshift(recipe);
        this.saveRecipes();
        this.updateCategoryOptions();
        this.renderRecipes();
        this.closeAddModal();
    }

    // レシピ削除
    deleteRecipe(id, event) {
        event.stopPropagation();
        if (confirm('このレシピを削除しますか？')) {
            this.recipes = this.recipes.filter(r => r.id !== id);
            this.saveRecipes();
            this.updateCategoryOptions();
            this.renderRecipes();
        }
    }

    // 調理済みステータスの切り替え
    toggleCooked(id, value) {
        const recipe = this.recipes.find(r => r.id === id);
        if (recipe) {
            recipe.cooked = value;
            this.saveRecipes();
            this.renderRecipes();
        }
    }

    // 評価の設定
    setRating(id, rating) {
        const recipe = this.recipes.find(r => r.id === id);
        if (recipe) {
            recipe.rating = rating;
            this.saveRecipes();
            this.renderRecipes();
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

    // 写真選択処理
    handlePhotoSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            this.currentPhotoData = event.target.result;
            document.getElementById('photo-preview').innerHTML =
                `<img src="${this.currentPhotoData}" alt="プレビュー">`;
        };
        reader.readAsDataURL(file);
    }

    // 調理記録を保存
    saveLog() {
        const recipe = this.recipes.find(r => r.id === this.currentRecipeId);
        if (!recipe) return;

        const log = {
            id: Date.now(),
            date: document.getElementById('log-date').value,
            note: document.getElementById('log-note').value.trim(),
            photo: this.currentPhotoData
        };

        if (!recipe.logs) recipe.logs = [];
        recipe.logs.unshift(log);

        // 調理記録を追加したら自動的に「作った」にする
        recipe.cooked = true;
        document.getElementById('detail-cooked-checkbox').checked = true;

        this.saveRecipes();
        this.renderLogs(recipe);
        this.renderRecipes();
        this.hideLogForm();
    }

    // 調理記録の削除
    deleteLog(logId) {
        if (!confirm('この記録を削除しますか？')) return;

        const recipe = this.recipes.find(r => r.id === this.currentRecipeId);
        if (!recipe) return;

        recipe.logs = recipe.logs.filter(l => l.id !== logId);
        this.saveRecipes();
        this.renderLogs(recipe);
        this.renderRecipes();
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
                recipes.sort((a, b) => b.id - a.id);
                break;
            case 'oldest':
                recipes.sort((a, b) => a.id - b.id);
                break;
            case 'name':
                recipes.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
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
