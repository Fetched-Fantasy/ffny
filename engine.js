 // World editor state
        let scene, camera, engine, selectedMesh = null;
        let worldObjects = [];

        // Initialize the engine
        const canvas = document.createElement('canvas');
        canvas.className = 'game-canvas';
        const gameRoot = document.getElementById('game-root');
        if (gameRoot) {
            gameRoot.appendChild(canvas);
        }

        // Create engine and scene
        engine = new BABYLON.Engine(canvas, true);
        
        function createScene() {
            scene = new BABYLON.Scene(engine);
            scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.2);

            // Editor camera
            camera = new BABYLON.ArcRotateCamera("editorCamera", 
                Math.PI / 2, Math.PI / 3, 
                10, BABYLON.Vector3.Zero(), scene);
            camera.attachControl(canvas, true);
            camera.lowerRadiusLimit = 2;
            camera.upperRadiusLimit = 50;

            // Default light
            const light = new BABYLON.HemisphericLight("defaultLight", 
                new BABYLON.Vector3(0, 1, 0), scene);

            // Grid for reference
            const gridSize = 20;
            const grid = BABYLON.MeshBuilder.CreateGround("grid", {
                width: gridSize,
                height: gridSize,
                subdivisions: gridSize
            }, scene);
            const gridMat = new BABYLON.StandardMaterial("gridMat", scene);
            gridMat.wireframe = true;
            gridMat.alpha = 0.5;
            grid.material = gridMat;
            grid.isPickable = false;

            // Gizmo for object manipulation
            const gizmoManager = new BABYLON.GizmoManager(scene);
            gizmoManager.positionGizmoEnabled = true;
            gizmoManager.rotationGizmoEnabled = true;
            gizmoManager.scaleGizmoEnabled = true;
            gizmoManager.attachableMeshes = [];

            // Click to select objects
            scene.onPointerDown = function(evt, pickResult) {
                if (pickResult.hit && pickResult.pickedMesh !== grid) {
                    selectObject(pickResult.pickedMesh);
                    gizmoManager.attachToMesh(pickResult.pickedMesh);
                } else {
                    selectObject(null);
                    gizmoManager.attachToMesh(null);
                }
            };

            return scene;
        }

        scene = createScene();

        // Run render loop
        engine.runRenderLoop(() => {
            scene.render();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            engine.resize();
        });

        // Object creation functions
        function addCube() {
            const cube = BABYLON.MeshBuilder.CreateBox("cube_" + Date.now(), {
                size: 1
            }, scene);
            cube.position.y = 0.5;
            worldObjects.push(cube);
            updateObjectList();
            selectObject(cube);
            return cube;
        }

        function addSphere() {
            const sphere = BABYLON.MeshBuilder.CreateSphere("sphere_" + Date.now(), {
                diameter: 1
            }, scene);
            sphere.position.y = 0.5;
            worldObjects.push(sphere);
            updateObjectList();
            selectObject(sphere);
            return sphere;
        }

        function addGround() {
            const ground = BABYLON.MeshBuilder.CreateGround("ground_" + Date.now(), {
                width: 6,
                height: 6
            }, scene);
            worldObjects.push(ground);
            updateObjectList();
            selectObject(ground);
            return ground;
        }

        function addLight() {
            const light = new BABYLON.PointLight("light_" + Date.now(), 
                new BABYLON.Vector3(0, 3, 0), scene);
            light.intensity = 0.7;
            
            // Create a small sphere to represent the light
            const lightSphere = BABYLON.MeshBuilder.CreateSphere("lightSphere_" + Date.now(), {
                diameter: 0.2
            }, scene);
            lightSphere.position = light.position;
            const lightMat = new BABYLON.StandardMaterial("lightMat", scene);
            lightMat.emissiveColor = new BABYLON.Color3(1, 1, 0);
            lightSphere.material = lightMat;
            
            // Link light to sphere
            lightSphere.light = light;
            worldObjects.push(lightSphere);
            updateObjectList();
            selectObject(lightSphere);
            return lightSphere;
        }

        // UI update functions
        function updateObjectList() {
            const list = document.getElementById('objectList');
            list.innerHTML = '';
            worldObjects.forEach(obj => {
                const div = document.createElement('div');
                div.className = 'object-item';
                div.textContent = obj.name;
                if (obj === selectedMesh) {
                    div.style.background = 'rgba(255, 255, 255, 0.2)';
                }
                div.onclick = () => selectObject(obj);
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '×';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteObject(obj);
                };
                div.appendChild(deleteBtn);
                list.appendChild(div);
            });
        }

        function updateProperties() {
            const props = document.getElementById('properties');
            props.innerHTML = '';
            
            if (!selectedMesh) return;

            // Position
            ['x', 'y', 'z'].forEach(axis => {
                const row = document.createElement('div');
                row.className = 'property-row';
                row.innerHTML = `
                    <label>Position ${axis.toUpperCase()}</label>
                    <input type="number" step="0.1" value="${selectedMesh.position[axis]}"
                        onchange="updatePosition('${axis}', this.value)">
                `;
                props.appendChild(row);
            });

            // Rotation
            ['x', 'y', 'z'].forEach(axis => {
                const row = document.createElement('div');
                row.className = 'property-row';
                row.innerHTML = `
                    <label>Rotation ${axis.toUpperCase()}</label>
                    <input type="number" step="0.1" value="${selectedMesh.rotation[axis]}"
                        onchange="updateRotation('${axis}', this.value)">
                `;
                props.appendChild(row);
            });

            // Scale
            ['x', 'y', 'z'].forEach(axis => {
                const row = document.createElement('div');
                row.className = 'property-row';
                row.innerHTML = `
                    <label>Scale ${axis.toUpperCase()}</label>
                    <input type="number" step="0.1" value="${selectedMesh.scaling[axis]}"
                        onchange="updateScale('${axis}', this.value)">
                `;
                props.appendChild(row);
            });

            // Material color
            if (selectedMesh.material) {
                const row = document.createElement('div');
                row.className = 'property-row';
                row.innerHTML = `
                    <label>Color</label>
                    <input type="color" value="#ffffff"
                        onchange="updateColor(this.value)">
                `;
                props.appendChild(row);
            }
        }

        // Property update functions
        function updatePosition(axis, value) {
            if (selectedMesh) {
                selectedMesh.position[axis] = parseFloat(value);
                if (selectedMesh.light) {
                    selectedMesh.light.position[axis] = parseFloat(value);
                }
            }
        }

        function updateRotation(axis, value) {
            if (selectedMesh) {
                selectedMesh.rotation[axis] = parseFloat(value);
            }
        }

        function updateScale(axis, value) {
            if (selectedMesh) {
                selectedMesh.scaling[axis] = parseFloat(value);
            }
        }

        function updateColor(value) {
            if (selectedMesh && selectedMesh.material) {
                const color = BABYLON.Color3.FromHexString(value);
                selectedMesh.material.diffuseColor = color;
            }
        }

        // Selection and deletion
        function selectObject(mesh) {
            selectedMesh = mesh;
            updateObjectList();
            updateProperties();
        }

        function deleteObject(obj) {
            const index = worldObjects.indexOf(obj);
            if (index > -1) {
                worldObjects.splice(index, 1);
                if (obj.light) {
                    obj.light.dispose();
                }
                obj.dispose();
                if (selectedMesh === obj) {
                    selectObject(null);
                } else {
                    updateObjectList();
                }
            }
        }

        // World save/load functions
        function serializeWorld() {
            const worldData = {
                name: document.getElementById('worldName').value || 'Untitled World',
                objects: worldObjects.map(obj => ({
                    type: obj.name.split('_')[0],
                    name: obj.name,
                    position: obj.position.asArray(),
                    rotation: obj.rotation.asArray(),
                    scaling: obj.scaling.asArray(),
                    isLight: !!obj.light
                }))
            };
            return worldData;
        }

        function saveWorld() {
            const worldData = serializeWorld();
            const worldsString = localStorage.getItem('ffny.worlds') || '[]';
            const worlds = JSON.parse(worldsString);
            
            // Update existing or add new
            const existingIndex = worlds.findIndex(w => w.name === worldData.name);
            if (existingIndex >= 0) {
                worlds[existingIndex] = worldData;
            } else {
                worlds.push(worldData);
            }
            
            localStorage.setItem('ffny.worlds', JSON.stringify(worlds));
            alert('World saved successfully!');
        }

        function loadWorld() {
            const worldsString = localStorage.getItem('ffny.worlds') || '[]';
            const worlds = JSON.parse(worldsString);
            
            if (worlds.length === 0) {
                alert('No saved worlds found!');
                return;
            }

            // Create world selection dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                padding: 20px;
                border-radius: 8px;
                z-index: 2000;
            `;

            dialog.innerHTML = `
                <h3 style="margin-top:0">Select World</h3>
                <select id="worldSelect" style="width:100%;margin-bottom:10px;padding:5px;">
                    ${worlds.map(w => `<option value="${w.name}">${w.name}</option>`).join('')}
                </select>
                <button onclick="loadSelectedWorld()" style="margin-right:5px">Load</button>
                <button onclick="this.parentElement.remove()">Cancel</button>
            `;

            document.body.appendChild(dialog);
        }

        function loadSelectedWorld() {
            const select = document.getElementById('worldSelect');
            const worldName = select.value;
            const worldsString = localStorage.getItem('ffny.worlds') || '[]';
            const worlds = JSON.parse(worldsString);
            const worldData = worlds.find(w => w.name === worldName);

            if (worldData) {
                // Clear current world
                while (worldObjects.length > 0) {
                    deleteObject(worldObjects[0]);
                }

                // Load objects
                worldData.objects.forEach(obj => {
                    let mesh;
                    switch(obj.type) {
                        case 'cube':
                            mesh = addCube();
                            break;
                        case 'sphere':
                            mesh = addSphere();
                            break;
                        case 'ground':
                            mesh = addGround();
                            break;
                        case 'lightSphere':
                            mesh = addLight();
                            break;
                    }
                    if (mesh) {
                        mesh.position = BABYLON.Vector3.FromArray(obj.position);
                        mesh.rotation = BABYLON.Vector3.FromArray(obj.rotation);
                        mesh.scaling = BABYLON.Vector3.FromArray(obj.scaling);
                    }
                });

                document.getElementById('worldName').value = worldName;
                select.parentElement.remove();
            }
        }

        function publishWorld() {
            const worldData = serializeWorld();
            // Here you would typically send the world data to a server
            // For now, we'll just mark it as published locally
            const worldsString = localStorage.getItem('ffny.worlds') || '[]';
            const worlds = JSON.parse(worldsString);
            const existingIndex = worlds.findIndex(w => w.name === worldData.name);
            
            if (existingIndex >= 0) {
                worlds[existingIndex] = { ...worldData, published: true };
            } else {
                worlds.push({ ...worldData, published: true });
            }
            
            localStorage.setItem('ffny.worlds', JSON.stringify(worlds));
            alert('World published successfully! It will now appear in the world selection menu.');
        }

        // Event listeners
        document.getElementById('addCube').onclick = addCube;
        document.getElementById('addSphere').onclick = addSphere;
        document.getElementById('addGround').onclick = addGround;
        document.getElementById('addLight').onclick = addLight;
        document.getElementById('saveWorld').onclick = saveWorld;
        document.getElementById('loadWorld').onclick = loadWorld;
        document.getElementById('publishWorld').onclick = publishWorld;
        if (document.getElementById('setHomeWorld')) {
            document.getElementById('setHomeWorld').onclick = setHomeWorld;
        }

        // Asset browser state
        var importedAssets = [];

        function renderAssetGrid() {
            const grid = document.getElementById('assetGrid');
            if (!grid) return;
            grid.innerHTML = '';
            importedAssets.forEach((asset, idx) => {
                const card = document.createElement('div');
                card.style.cssText = 'background:rgba(255,255,255,0.04);border-radius:6px;padding:8px;display:flex;flex-direction:column;justify-content:space-between;height:140px;';
                const title = document.createElement('div');
                title.textContent = asset.name;
                title.style.fontSize = '13px';
                title.style.marginBottom = '8px';
                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.gap = '6px';
                const addBtn = document.createElement('button');
                addBtn.textContent = 'Add to Scene';
                addBtn.className = 'tool-button';
                addBtn.style.padding = '6px';
                addBtn.onclick = function(){
                    // if asset already has meshes, clone or reimport
                    if (asset.meshes && asset.meshes.length) {
                        asset.meshes.forEach(m => {
                            const clone = m.clone(m.name + '_clone_' + Date.now());
                            if (clone) {
                                worldObjects.push(clone);
                            }
                        });
                        updateObjectList();
                    } else if (asset.blobUrl) {
                        // try to import again from blob
                        importFromBlobUrl(asset.blobUrl, asset.name);
                    }
                };

                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'Remove';
                removeBtn.className = 'tool-button';
                removeBtn.style.padding = '6px';
                removeBtn.onclick = function(){
                    importedAssets.splice(idx, 1); renderAssetGrid();
                };

                actions.appendChild(addBtn);
                actions.appendChild(removeBtn);
                card.appendChild(title);
                card.appendChild(actions);
                grid.appendChild(card);
            });
        }

        function importFromBlobUrl(blobUrl, fileName) {
            // Attempt to import using SceneLoader.ImportMesh
            try {
                BABYLON.SceneLoader.ImportMesh('', blobUrl + '/', fileName, scene, function(meshes) {
                    // mark meshes as part of imported asset
                    const asset = importedAssets.find(a => a.name === fileName && a.blobUrl === blobUrl);
                    if (asset) asset.meshes = meshes;
                    // add primary mesh(s) to worldObjects
                    meshes.forEach(m => { if (m instanceof BABYLON.Mesh) { worldObjects.push(m); } });
                    updateObjectList();
                    renderAssetGrid();
                }, null, function(err) {
                    console.error('Import error', err);
                    alert('Failed to import ' + fileName + '. See console for details.');
                });
            } catch(e) {
                console.error('Import exception', e);
                alert('Import failed for ' + fileName);
            }
        }

        document.getElementById('assetImport').addEventListener('change', function(e){
            const files = Array.from(e.target.files || []);
            files.forEach(file => {
                const blobUrl = URL.createObjectURL(file);
                const assetEntry = { name: file.name, size: file.size, type: file.type, blobUrl: blobUrl, meshes: [] };
                importedAssets.push(assetEntry);
                // Try to import immediately into scene (keeps asset.meshes)
                importFromBlobUrl(blobUrl, file.name);
            });
            renderAssetGrid();
            // clear input so same file can be reselected later
            e.target.value = '';
        });

        function setHomeWorld() {
            const worldName = document.getElementById('worldName').value.trim();
            if (!worldName) {
                alert('Please enter a world name first');
                return;
            }

            const worldData = serializeWorld();
            const worldsString = localStorage.getItem('ffny.worlds') || '[]';
            const worlds = JSON.parse(worldsString);
            
            // Update existing or add new
            const existingIndex = worlds.findIndex(w => w.name === worldData.name);
            if (existingIndex >= 0) {
                worlds[existingIndex] = { ...worldData, published: true };
            } else {
                worlds.push({ ...worldData, published: true });
            }
            
            localStorage.setItem('ffny.worlds', JSON.stringify(worlds));
            localStorage.setItem('ffny.homeWorld', worldName);
            
            alert('World saved and set as your home world!');
        }