var $body         = $(document.body),
    $window       = $(window),
    $html         = $(document.documentElement),
    $document     = $(document),
    resize_timeout,
    windowHeight,
    windowWidth;

    
(function () {    
	function detect_size() {
        windowWidth = $window.width();//获取窗口大小
        windowHeight = $window.height();
        $('canvas').css({ width: windowWidth, height: windowHeight });//设置画布大小；
        if (renderer) {
            camera.aspect = windowWidth / windowHeight;//照相机的长宽比
            camera.updateProjectionMatrix();//更新投影矩阵
            renderer.setSize(windowWidth, windowHeight);//重置渲染器的宽高
            PhotoList.init();//重新获取PhotoList的高度数据
        }
    }
	
    detect_size();

    window.onresize = function (event) {
        clearTimeout(resize_timeout);
        resize_timeout = setTimeout(function () {
            detect_size();
        }, 100);
    }; 
    $('#loader video').prop('preload', true);
    
    

	//requestAnimationFrame，告诉浏览器在合适的时候调用指定函数，通常可能达到60FPS。
	//老的浏览器可能不支持，所以做好兼容；
	//也可这个方法原理其实也就跟setTimeout/setInterval差不多，通过递归调用同一方法来不断更新画面以达到动起来的效果，但它优于setTimeout/setInterval的地方在于它是由浏览器专门为动画提供的API，在运行时浏览器会自动优化方法的调用，并且如果页面不是激活状态下的话，动画会自动暂停，有效节省了CPU开销。
	
	window.requestAnimFrame = (function(){
        return  window.requestAnimationFrame       ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame    ||
                window.oRequestAnimationFrame      ||
                window.msRequestAnimationFrame     ||
                function( callback ){
                    window.setTimeout(callback, 1000 / 60);
                };
    })();
    
//  var requestAnimationFrame = window.requestAnimationFrame 
//          || window.mozRequestAnimationFrame
//          || window.webkitRequestAnimationFrame
//          || window.msRequestAnimationFrame
//          || window.oRequestAnimationFrame;
//  window.requestAnimationFrame = requestAnimationFrame;
    //window.setTimeout(requestAnimationFrame(render), 2000);
	//requestAnimationFrame(render);
	
	//绘画的参数
	var width    = window.innerWidth,//窗口大小
        height   = window.innerHeight,
        radius   = 0.5,//半径
        segments = 32,//切片数
        rotatingNews = [];


//texture   纹理
//material  材质
//geometry  几何形状

//GL_LINEAR_MIPMAP_LINEAR





	//创建地球函数
	function createSphere(radius, segments) {
		//将图片导入纹理中；
		var texture_loader = new THREE.TextureLoader();
	    var texture = texture_loader.load('img/EARTH-fixed.jpg');
	    texture.anisotropy = 100;//经常用来通过这个值,产生不同的表面效果,木材和金属都发光,但是发光的特点是有区别的
	    texture.minFilter = THREE.NearestMipMapNearestFilter;//纹理缩小滤镜(纹理在缩小时的过滤方式)采用最近滤镜
	   	texture.magFilter = THREE.LinearMipMapLinearFilter;//纹理放大滤镜(纹理在放大时的过滤方式)采用线性滤镜
	   	//Mesh(geometry, material)创建栅格
	   	var geometry = new THREE.SphereGeometry(radius, segments, segments);
	   	//Phong材质（MeshPhongMaterial）是符合Phong光照模型的材质。和Lambert不同的是，Phong模型考虑了镜面反射的效果，因此对于金属、镜面的表现尤为适合。
	   	var material = new THREE.MeshPhongMaterial({
			            map: texture,
			            specular: new THREE.Color('grey')//镜面反射系数，镜面光
				   });
	    var Mesh = new THREE.Mesh(geometry, material);
	    return Mesh;
	}
	//创建星星函数
	
	function createStars(radius, segments) {
		var texture_loader = new THREE.TextureLoader();
		var texture = texture_loader.load('img/galaxy_starfield.jpg');
	    var geometry = new THREE.SphereGeometry(radius, segments, segments);
	    var material = new THREE.MeshBasicMaterial({
	        map:  texture,
	        side: THREE.BackSide//渲染面片正面或是反面，默认为正面THREE.FrontSide，可设置为反面THREE.BackSide，或双面THREE.DoubleSide
	    });
	    var Mesh = new THREE.Mesh(geometry,material);
		return Mesh;
	}

	
	function create2D(id, callback) {
		var texture_loader = new THREE.TextureLoader();
        var texture = texture_loader.load('img/flying' + id + '.png');
        texture.minFilter = THREE.NearestMipMapNearestFilter;
        texture.magFilter = THREE.LinearMipMapLinearFilter;
        var plane = new THREE.PlaneGeometry(64, 64, 1, 1);//平面（PlaneGeometry）其实是一个长方
        var material = new THREE.MeshBasicMaterial({ map: texture });
        material.transparent = true;//材质是否透明，如果为true则结合opacity设置透明度。如果为false则物体不透明
       	material.side = THREE.DoubleSide;//侧面，觉得几何体的哪一面应用这个材质，默认为THREE.FrontSide(前外面)，还有THREE.BackSide(后内面)和THREE.DoubleSide(两面)
        var cube = new THREE.Mesh(plane, material);//cube就是漂浮物
        
        callback(cube);
    }
	
    function createObject(name, isNew, fn, callback) {
        var texture_loader = new THREE.TextureLoader();
        var texture = texture_loader.load('img/' + name + '.jpg',function(texture){
        	texture.needsUpdate = true;//告诉renderer这一帧我该更新缓存了,纹理加载是异步的。需要放到回调函数里面，不然报错Texture marked for update but image is undefined
	        texture.anisotropy = 16;//各向异性
	        texture.minFilter = THREE.NearestMipMapNearestFilter;
	        texture.magFilter = THREE.LinearMipMapLinearFilter;
        });
        var objloader = new THREE.OBJLoader();//创建一个有材质的模型
        objloader.load('obj/' + name + '.obj', function(object) {
            object.traverse(function(child) {
                if (child instanceof THREE.Mesh) {
                    child.material.map = texture;
                    child.callback = fn;
                }
            });
            
            //通过Three.js自带的功能来组合和合并已有的几何体，创建出新的几何体
            var total = new THREE.Object3D();
            //内容有跟新的话，创建更新图标
            if (isNew) {
                var temp = new THREE.Object3D();
                //Box3对象的构造函数.用来在三维空间内创建一个立方体边界对象.如果没有参数min,max将立方体边界初始化为Infinity,无穷大
                //setFromPoints方法通过Vector3对象组成的points数组重新设置立方体边界的最小值,最大值,min,max坐标值.并返回新的坐标值的立方体边界. 
                var box = new THREE.Box3().setFromObject(object);//创建一个立方体边界对象，并且大小设置为object大小；
                //size方法用来返回立方体边界尺寸的向量
               	var size = box.getSize().x + box.getSize().y;
               	//创造一个圆柱体new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radiusSegments, heightSegments, openEnded)
               	//其中，radiusTop与radiusBottom分别是顶面和底面的半径，由此可知，当这两个参数设置为不同的值时，实际上创建的是一个圆台；height是圆柱体的高度；radiusSegments与heightSegments可类比球体中的分段；openEnded是一个布尔值，表示是否没有顶面和底面，缺省值为false，表示有顶面和底面。
                var geo = new THREE.CylinderGeometry(size/6, size/6, size/6, 32, 1, true);
                var texture_loader = new THREE.TextureLoader();
                var tex = texture_loader.load('img/rotatenew.jpg');
                tex.minFilter = THREE.NearestMipMapNearestFilter;
                tex.magFilter = THREE.LinearMipMapLinearFilter;
                var material = new THREE.MeshBasicMaterial({ map: tex });
                material.transparent = true;
                var cylinder = new THREE.Mesh(geo, material);//创建圆柱体网格
                cylinder.material.side = THREE.DoubleSide;
                
                temp.position.x = box.min.x;
                temp.position.y = box.max.y;
                temp.position.z = box.min.z/2;
                temp.rotation.z = .4;
                
                temp.add(cylinder);
                total.add(temp);
                
                rotatingNews.push(cylinder);//把圆柱体放到到要旋转的有更新数组里；
            }
            total.add(object);

            callback(total);
        });
    }
	    
	    
		

	//设置场景scene，场景就是一个三维空间。
    var scene = new THREE.Scene();
    //设置透视投影的相机
    //THREE.PerspectiveCamera(fov, aspect, near, far)
    	//fov是视景体竖直方向上的张角（是角度制而非弧度制）
    	//aspect等于width / height，是照相机水平方向和竖直方向长度的比值，通常设为Canvas的横纵比
    	//near和far分别是照相机到视景体最近、最远的距离，均为正值，且far应大于near。
    var camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    camera.position.z = 3;//设置照相机位置
	//用js代码生成canvas；
	 	//生成渲染器对象（属性：抗锯齿效果为设置有效）
    var renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(width, height);//指定渲染器的高宽（和画布框大小一致）
    document.body.appendChild(renderer.domElement);
    //我们可以使用下面的代码将背景色（用于清除画面的颜色）设置为黑色；
//  renderer.autoClear = false;
	renderer.setClearColor(0x000000);
	//设置光源light
		//设置的是环境光；
		//环境光是指场景整体的光照效果，是由于场景内若干光源的多次反射形成的亮度一致的效果，
		//通常用来为整个场景指定一个基础亮度。因此，环境光没有明确的光源位置，在各处形成的亮度也是一致的。
		//在设置环境光时，只需要指定光的颜色：
	var light = new THREE.AmbientLight(0xffffff);
	scene.add(light);//讲光源添加到场景中
	//创建地球
	var sphere = createSphere(radius, segments);
	//scene.add(sphere);
	//rotation改变的是子对象的坐标系，但是不改变本身的坐标系角度，
	//所以想要改变其自身的坐标系方向，可以为其添加父对象，然后改变父对象的rotation。
	var earth = new THREE.Object3D();
	earth.add(sphere);
	earth.rotation.y = 180;
	//创建星星
	var stars = createStars(90, 64);
	//把地球和星星添加到场景中去
	scene.add(earth);
	scene.add(stars);
//	renderer.render(scene, camera);

	//TextureAnimator函数调整原始图像以显示动画。 它在从第一个到最后一个图像的图像的图像之间切换。
	//指定的时间间隔。 每个瓦片在一定的持续时间内可见，

	var texture_loader1 = new THREE.TextureLoader();
    var blinkTexture = texture_loader1.load('img/blink.jpg');
    var blink = new TextureAnimator(blinkTexture, 2, 1, 2, 250); // texture, #horiz, #vert, #total, duration.//纹理，水平，垂直，数量，持续时间
    var blinkMaterial = new THREE.MeshBasicMaterial({ map: blinkTexture, side:THREE.DoubleSide });
    var texture_loader2 = new THREE.TextureLoader();
    var newBlinkTexture = texture_loader2.load('img/blinknew.jpg');
    var newBlink = new TextureAnimator(newBlinkTexture, 2, 1, 2, 250); // texture, #horiz, #vert, #total, duration.//纹理，水平，垂直，数量，持续时间
    var newBlinkMaterial = new THREE.MeshBasicMaterial({ map: newBlinkTexture, side:THREE.DoubleSide });
    var blinkGeometry = new THREE.SphereGeometry(radius/100, segments, segments);
    var objects = [];
    var instas = [
	    {//坐着的女人的眼睛
	    	lat: -11,
            lng: 117,
            pics: 0
	    },
	    {//骆驼左眼
	    	lat: 5,
            lng: 319,
            pics: 0
	    },
	    {//骆驼右眼
	    	lat: 4,
            lng: 322,
            pics: 0
	    },
	    {//正面的女人的眼睛
	    	lat: -7,
            lng: 24,
            pics: 0
	    },
	    {//海里的那只眼
	    	lat: 19,
            lng: 162,
            pics: 0
	    },
	    {//海里旁边岛上的那只眼
	    	lat: 32,
            lng: 148,
            pics: 0
	    },
	    {//鲨鱼眼
	    	lat: -22,
            lng: 254,
            pics: 0
	    },
	    {//吉他旁边的女人眼
	    	lat:51,
            lng: 281,
            pics: 0
	    },
	    {//食人鱼眼睛
	    	lat: -40,
            lng: 50,
            pics: 0
	    }
	];
    

    //现在我们如何将2D空间中的点转换为3D球？幸运的是有一套标准的方法。维基百科上面的文章
    //https://en.wikipedia.org/wiki/Spherical_coordinate_system
    //此函数将x，y(lat, lon)坐标转换为3D空间中的点。这里提供的半径是地球的半径，高度用作我们要开始绘制的表面上方的高度的偏移量。
    function latLongToVector3(lat, lon, radius, heigth) {
        var phi = (lat)*Math.PI/180;
        var theta = (lon-180)*Math.PI/180;

        var x = -(radius+heigth) * Math.cos(phi) * Math.cos(theta);
        var y = (radius+heigth) * Math.sin(phi);
        var z = (radius+heigth) * Math.cos(phi) * Math.sin(theta);

        return new THREE.Vector3(x,y,z);
    }
  
	//创造眼睛函数，并且把眼睛你加入到earth中
    function createImage(pics, lat, lng, first) {
        var ball = new THREE.Mesh(blinkGeometry, first ? newBlinkMaterial : blinkMaterial);
        var pos = latLongToVector3(lat, lng, radius, 0.01);
        ball.position.set(pos.x, pos.y, pos.z);
        earth.add(ball);
        //objects.push(ball); 
    }
    //创造眼睛
    function createInstas() {
        for (var i = 0; i < instas.length; i++) {
            createImage(instas[i].pics, instas[i].lat, instas[i].lng, i === 0);
        }
    }
    createInstas();
  
	
    var parents = []; //公转数组
    var logos = [];  //自转数组
	
    /* FIRST PARENT */
    var parent = new THREE.Object3D();
    //var opposite = new THREE.Mesh(geometry, material);
    //parent.add(opposite);
    createObject('Oakley-logo', bang.isNew.oakley, function() {
        showContent('oakley');
    }, function(obj) {
        var scale = .0005*bang.scale.oakley;
        obj.position.x = -1;
        obj.position.z = .8;
        obj.scale.set(scale,scale,scale);

        objects.push(obj);
        logos.push(obj);
        parent.add(obj);
    });

    createObject('gibson', bang.isNew.about, function() {
        showContent('about');
    }, function(obj) {
        var scale = .0005*bang.scale.about;
        obj.scale.set(scale,scale,scale);
        obj.position.x = .8;
        obj.position.z = -.2
        objects.push(obj);
        logos.push(obj);
        parent.add(obj);
    });
    parents.push(parent);

    /* SECOND PARENT */
    var parent2 = new THREE.Object3D();
    createObject('video', bang.isNew.videos, function() {
        showContent('videos');
    }, function(obj) {
        var scale = .0005*bang.scale.videos;
        obj.scale.set(scale,scale,scale);
        obj.position.x = .4;
        obj.position.z = .8;
        obj.position.y = -.05;
        objects.push(obj);
        logos.push(obj);
        parent2.add(obj);
    });

    createObject('kamera_hus', bang.isNew.photos, function() {
        showContent('photos');
    }, function(hus) {
        var kamera = new THREE.Object3D();
        createObject('kamera_objektiv', false, function() {
            showContent('photos');
        }, function(objektiv) {
            var scale = .001*bang.scale.photos;
            hus.scale.set(scale, scale, scale);
            objektiv.scale.set(scale, scale, scale);
            objektiv.position.x = -.004;

            kamera.callback = function() {
                showContent('photos');
            }
            kamera.add(hus);
            kamera.add(objektiv);
            kamera.position.x = -.9;
            objects.push(kamera);
            logos.push(kamera);
            parent2.add(kamera);
        })
    })

    parents.push(parent2);

    /* THIRD PARENT */
    var parent3 = new THREE.Object3D();

    createObject('burton', bang.isNew.burton, function() {
        showContent('burton');
    }, function(obj) {
        var scale = .0005*bang.scale.burton;
        obj.scale.set(scale,scale,scale);
        obj.position.x = -.3;
        obj.position.z = .9;
        obj.position.y = .1;
        objects.push(obj);
        logos.push(obj);
        parent3.add(obj);
    });

    createObject('pokal', bang.isNew.merits, function() {
        showContent('merits');
    }, function(obj) {
        var scale = .0012*bang.scale.merits;
        obj.scale.set(scale,scale,scale);
        obj.position.x = -0.5;
        obj.position.z = -.8;
        obj.position.y = .15;
        objects.push(obj);
        logos.push(obj);
        parent3.add(obj);
    });
    parents.push(parent3);



    /* FOURTH PARENT */
    var parent4 = new THREE.Object3D();
    createObject('gravis', bang.isNew.gravis, function() {
        showContent('gravis');
    }, function(obj) {
        var scale = .0005*bang.scale.gravis;
        obj.position.x = -.3;
        obj.position.z = -.9;
        obj.position.y = -.2;
        obj.scale.set(scale,scale,scale);

        objects.push(obj);
        logos.push(obj);
        parent4.add(obj);
    });

    createObject('nixon', bang.isNew.nixon, function() {
        showContent('nixon');
    }, function(obj) {
        var scale = .0005*bang.scale.nixon;
        obj.scale.set(scale,scale,scale);
        obj.position.x = .9;
        obj.position.z = .7;
        objects.push(obj);
        logos.push(obj);
        parent4.add(obj);
    });

    parents.push(parent4);

    /* FIFTH PARENT */
    var parent5 = new THREE.Object3D();
    createObject('skistar', bang.isNew.hemsedal, function() {
        showContent('hemsedal');
    }, function(obj) {
        var scale = .0005*bang.scale.hemsedal;
        obj.position.x = -1.1;
        obj.position.z = -.6;
        obj.position.y = -.1;
        obj.scale.set(scale,scale,scale);

        objects.push(obj);
        logos.push(obj);
        parent5.add(obj);
    });

    createObject('session', bang.isNew.session, function() {
        showContent('session');
    }, function(obj) {
        var scale = .0005*bang.scale.session;
        obj.scale.set(scale,scale,scale);
        obj.position.x = 1.3;
        obj.position.z = .3;
        objects.push(obj);
        logos.push(obj);
        parent5.add(obj);
    });

    createObject('video_kamera', bang.isNew.behind_the_scenes, function() {
        showContent('behind-the-scenes');
    }, function(obj) {
        var scale = .001*bang.scale.behind_the_scenes;
        obj.scale.set(scale,scale,scale);
        obj.position.x = .5;
        obj.position.z = -.65;
        objects.push(obj);
        logos.push(obj);
        parent5.add(obj);
    });

    parents.push(parent5);


    /* flying objects parents */
    var flyers = new THREE.Object3D(),
        planes = [],
        planeScale = .005 * bang.debrisScale;

    function randScale() {
        return planeScale*(Math.random()*.7+.5);
    }
    create2D(1, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 3;
        obj.position.y = -3;
        obj.position.z = 0;
        flyers.add(obj);
        planes.push(obj);
    });
    create2D(2, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -2;
        obj.position.y = -3;
        obj.position.z = -3;
        flyers.add(obj);
        planes.push(obj);
    });

    var flyers2 = new THREE.Object3D();
    create2D(3, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 3;
        obj.position.y = 3;
        obj.position.z = -3;
        flyers2.add(obj);
        planes.push(obj);
    });
    create2D(4, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -3;
        obj.position.y = 0;
        obj.position.z = -2;
        flyers2.add(obj);
        planes.push(obj);
    });
    create2D(5, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 0;
        obj.position.y = -3;
        obj.position.z = -3;
        flyers2.add(obj);
        planes.push(obj);
    });
    create2D(6, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 3;
        obj.position.y = -3;
        obj.position.z = 3;
        flyers2.add(obj);
        planes.push(obj);
    });

    var flyers3 = new THREE.Object3D();
    create2D(7, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 0;
        obj.position.y = 3;
        obj.position.z = 3;
        flyers3.add(obj);
        planes.push(obj);
    });
    create2D(8, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 3;
        obj.position.y = 0;
        obj.position.z = 3;
        flyers3.add(obj);
        planes.push(obj);
    });
    create2D(9, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 0;
        obj.position.y = 0;
        obj.position.z = -4;
        flyers3.add(obj);
        planes.push(obj);
    });
    create2D(10, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -4;
        obj.position.y = 0;
        obj.position.z = 1;
        flyers3.add(obj);
        planes.push(obj);
    });
    create2D(11, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -2;
        obj.position.y = 4;
        obj.position.z = 0;
        flyers3.add(obj);
        planes.push(obj);
    });
    create2D(12, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -2;
        obj.position.y = -4;
        obj.position.z = 0;
        flyers3.add(obj);
        planes.push(obj);
    });
    create2D(13, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -4;
        obj.position.y = -4;
        obj.position.z = 1;
        flyers3.add(obj);
        planes.push(obj);
    });

    var flyers4 = new THREE.Object3D();
    create2D(14, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -4;
        obj.position.y = 0;
        obj.position.z = 2;
        flyers4.add(obj);
        planes.push(obj);
    });
    create2D(15, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -3;
        obj.position.y = 3;
        obj.position.z = 2;
        flyers4.add(obj);
        planes.push(obj);
    });
    create2D(16, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -2;
        obj.position.y = 4;
        obj.position.z = 0;
        flyers4.add(obj);
        planes.push(obj);
    });
    create2D(17, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 4;
        obj.position.y = 1;
        obj.position.z = 2;
        flyers4.add(obj);
        planes.push(obj);
    });
    create2D(18, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 3;
        obj.position.y = 4;
        obj.position.z = 0;
        flyers4.add(obj);
        planes.push(obj);
    });
    create2D(19, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 0;
        obj.position.y = 4;
        obj.position.z = 3;
        flyers4.add(obj);
        planes.push(obj);
    });

    var flyers5 = new THREE.Object3D();
    create2D(20, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = 0;
        obj.position.y = -4;
        obj.position.z = -2;
        flyers5.add(obj);
        planes.push(obj);
    });
    create2D(21, function(obj) {
        var tScale = randScale();
        obj.scale.set(tScale,tScale,tScale);
        obj.position.x = -2;
        obj.position.y = 1;
        obj.position.z = -3;
        flyers5.add(obj);
        planes.push(obj);
    });

    scene.add(flyers);
    scene.add(flyers2);
    scene.add(flyers3);
    scene.add(flyers4);
    scene.add(flyers5);

    for (var i = 0; i < parents.length; i++) {
        scene.add(parents[i]);
    }
	//renderer.render(scene, camera);
	
	var rotation = 0.0004,//弧度是单位
        startZoom = 400,//开始的缩放比例
        endZoom = 2,//最终的缩放比例
        curTime = 0,
        finishedZoom = false;

//		自定义 easingout(先快后慢)函数，它将接收计算贝塞尔曲线所需的4个参数：
//		t (当前时间);
//		b (开始值);
//		c (开始值和目标值之间的差值);
//		d (总消耗时间).
    function easeout(t, b, c, d) {
        var ts=(t/=d)*t;
        var tc=ts*t;
        return b+c*(0.994999999999997*tc*ts + -4.995*ts*ts + 10*tc + -10*ts + 5*t);
    }
    
    var controls;//TrackballControls 的控制参数
    
    function setUpControls() {
        controls = new THREE.TrackballControls(camera, renderer.domElement);
        controls.noPan = true;
        controls.minDistance = 1.4;
        controls.maxDistance = 150;
    }

    var clock = new THREE.Clock();
    var inOuterSpace = false;
    function render() {
    	//这是所有obj的公转
        parents.forEach(function(obj, i) {
            parents[i].rotation.y += rotation;
        });

        planes.forEach(function(obj) {
            //obj.quaternion.copy(camera.quaternion);
            obj.lookAt(camera.position);
        });
		//漂浮物公转
        flyers.rotation.y += rotation*bang.debrisSpeed;
        flyers.rotation.z += rotation;

        flyers2.rotation.y += rotation*bang.debrisSpeed;
        flyers2.rotation.z += -rotation;

        flyers3.rotation.y += -rotation*bang.debrisSpeed;
        flyers3.rotation.z += rotation;

        flyers4.rotation.y += -rotation*bang.debrisSpeed;
        flyers4.rotation.z += -rotation;

        flyers5.rotation.y += rotation*bang.debrisSpeed;
        flyers5.rotation.z += rotation*bang.debrisSpeed;
		//这是所有obj的自转
        logos.forEach(function(obj, i) {
            obj.rotation.y += rotation * bang.logoRotation * (1+i/10);
        });
        //更新图标的自转，并且是反方向的
        rotatingNews.forEach(function(obj) {
            obj.rotation.y -= rotation*10;
        });
		//地球的自转
        earth.rotation.y += .0005;

		//开场的由快到慢的进入
        if (curTime < 2) {
            curTime += 2/150;
            var curZoom = easeout(curTime, 0, startZoom - endZoom, 2);
            camera.position.z = startZoom - curZoom;

        } else if (!finishedZoom) {
            camera.position.z = endZoom;
            finishedZoom = true;
            $('#loader').remove();
            setUpControls();//添加TrackballControls控制器
        }
        if ( controls || !finishedZoom) {
	        if (controls)
	            controls.update();//控制器跟新
	        //渲染器渲染换面
	        renderer.render(scene, camera);
	        
	        var delta = clock.getDelta();
	      	blink.update(1000 * delta);
	       	newBlink.update(1000 * delta);
	       	requestAnimationFrame(render);
       	}
    }
  
    
    //创建一个屏幕也就是鼠标2d坐标到3d场景坐标的转换工具projector
    //计算从屏幕坐标到 世界坐标的工具
    //var projector = new THREE.Projector();
	
   	var clickedObject = null;
    $('canvas').on('mousedown mouseup', function(event) {
        event.preventDefault();
        
        var mouseX = (event.clientX / window.innerWidth)*2-1;
   		var mouseY = -(event.clientY /window.innerHeight)*2+1; 
        //创建一个三维向量点，x、y是鼠标的x、y，z轴设置为是0.5，
        //只有 x y 坐标有意义，z轴的参数是可以改变的，并且改变后获得的threejs坐标的x,y，z数值上会改变，但是差值上不会改变。
         var vector = new THREE.Vector3(mouseX, mouseY, 0.5 );
        //将一个鼠标的2d坐标转成3d坐标
        vector.unproject(camera);
        //新建光线跟踪器   参数是摄像机的位置(vec)(应该是光线追踪器发射的初始位置) 和 鼠标点击那点和摄像机位置 相减 得到的法向量 (光线发射的方向)
		//可以将光线投射到 3D 场景中，并确定光线是否与场景中指定的 3D 对象集合相交。
        var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
		////光线发射 得出与object数组相交的对象的集合 (object 数组是一系列的待相交对象)(参数也可是object3D.children)
        var intersects = raycaster.intersectObjects(objects, true);
		//console.log(event.type);

		if (intersects.length > 0) {
            if (event.type == 'mousedown'){
            	clickedObject = intersects[0].object;
            }
            if (event.type == 'mouseup'){
            	if (intersects[0].object == clickedObject){
            		intersects[0].object.callback();
            	}
                clickedObject = null;
            }       
        }
    });
    
    $document.on('mousedown mouseup', function(event) {
    	event.preventDefault();
    });
    
    $document.on('mousemove', function(event) {
        var cX = event.clientX;
        var cY = event.clientY;
        var vector = new THREE.Vector3((cX / window.innerWidth) * 2 - 1, - (cY / window.innerHeight) * 2 + 1, 0.5);
        vector.unproject(camera);
        var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
        var intersects = raycaster.intersectObjects(objects, true);

        if (intersects.length > 0)
            renderer.domElement.style.cursor = 'pointer';
        else
            renderer.domElement.style.cursor = 'default';
    })
    
    function loading(i) {
        $('#loader').addClass('done');
        render();
        setTimeout(function() {
            $('#loader').remove();
        }, 2000);
        if (location.hash.length > 3) {
            setTimeout(function() {
                showContent(location.hash.replace('#!', ''));
                $('html,body').scrollTop(0);
            }, 100);
        }
    }
    
    useLoader = true;
    if (useLoader){
        if (windowWidth > windowHeight) {
            $('#loader video').css({
                width: '100%',
                marginTop: -(windowWidth - windowHeight)/2
            });
        } else {
            $('#loader video').css({
                height: '100%',
                marginLeft: -(windowHeight - windowWidth)/2
            });
        }
        var loaderInited = false;
        var video = $('#loader video').get(0);
        if (video.readyState > 3) {
            loaderInited = true;
            setTimeout(loading, 4380);
            video.play();
        }
        $('#loader video').on('canplay', function() {
            if (loaderInited) return;
            loaderInited = true;
            setTimeout(loading, 4380);
            video.play();
        }).on('ended', function() {
            if (!loaderInited) {
                loading();
            }
        });
        video.play();
    } else {
        setTimeout(loading, 10);
    }
	
	
	var $photo = $('#photos .fullscreen'),
        $photoList = $photo.prev(),//ul
        $photoListItems = $photoList.find('li');//lis
    $document.on('click', '#photos ul li', function() {
        if ($(this).hasClass('active')) return;
        var $img = $(this).find('img');
        var bg = $img.data('src');
       
        $(this).addClass('active').siblings('.active').removeClass('active');
        $photo.addClass('change');
        var listScroll = $photoList.scrollTop() + ($img.offset().top - windowHeight/2) + ($img.outerHeight() / 2);
        //console.log(listScroll);
        $photoList.animate({ scrollTop: listScroll });
        setTimeout(function() {
            $photo.css('background-image', 'url("' + bg + '")').removeClass('change');
        }, 200);
        $body.css({ 'background-position': 'left ' + -(listScroll/10) + 'px' });
    });
    
    $document.on('keydown', function(e) {
        if (e.keyCode == 9) return false;
        if ($('#photos.show').length) {
            if (e.keyCode == 39 || e.keyCode == 40) {
                e.preventDefault();
                $photoList.find('.active').next().trigger('click');
            } else if (e.keyCode == 37 || e.keyCode == 38) {
                e.preventDefault();
                $photoList.find('.active').prev().trigger('click');
            }
        }
    });
    
    var showingPictureList = false;
	var photoListLoading = true;
    
    PhotoList = {
        active: false,
        items: [],
        listHeight: 0,
        element: null,
        init: function() {
            this.items = $.makeArray($photoListItems);//[lis]
            this.element = $photoList.get(0);//ul
            var singleHeight = $photoListItems.eq(0).height()/2;
            $photoList.css({
                paddingTop: windowHeight/2 - singleHeight,
                paddingBottom: windowHeight/2 - singleHeight
            });

            //ul的高度
            this.listHeight = this.element.offsetHeight;
			//console.log(this.listHeight)//759
            // 获取每一个li的偏移量
            for (var i = 0, len = this.items.length; i < len; i++) {
                var item = this.items[i];
                item._offsetHeight = item.offsetHeight;
                item._offsetTop = item.offsetTop;
                item._offsetBottom = item._offsetTop + item._offsetHeight;
                item._state = '';
            }
			
            // 强制更新
            this.update(true);
        },
        update: function(force) {
//          if (photoListLoading) {
//          	photoListLoading = false;
//          	setTimeout(function(){
//		            	PhotoList.init();
//	        	},700)//必须加定时器.要不img还没有加载完,获取的坐标位置是不准确的
//          	return;
//          }
			//.imagesLoaded()检测图片是否检测页面中的图片是否被加载的js插件。
			//.always在所有图片被加载或确认broken时触发。
			if (this.items.length === 0) {
                $photoList.imagesLoaded().always(function() {
					PhotoList.init();
				});
				return;
            }

			//var scrollTop    = $photoList.scrollTop(),
			var scrollTop    = this.element.pageYOffset || this.element.scrollTop,
           		scrollBottom = scrollTop + this.listHeight;
				//console.log(scrollTop);//0
				//console.log(scrollBottom);//759
            // 如果没有改变就退出

            if (scrollTop !== this.lastTop || force) {
                this.lastTop = scrollTop;
	
                // 循环一下li看下是否有改变
                for (var i = 0, len = this.items.length; i < len; i++) {
                    var item = this.items[i];

                    // 上面img视口
                    if (item._offsetBottom < scrollTop) {
                        // Exclusion via string matching improves performance
                        if (item._state !== 'past') {
                            item._state = 'past';
                            item.classList.add('past');
                            item.classList.remove('future');
                        }
                    }
                    // 下面的img的视口
                    else if (item._offsetTop > scrollBottom) {
                        // Exclusion via string matching improves performance
                        if (item._state !== 'future') {
                            item._state = 'future';
                            item.classList.add('future');
                            item.classList.remove('past');
                        }
                    }
                    // Inside of list viewport
                    else if (item._state) {
                        if (item._state === 'past') item.classList.remove('past');
                        if (item._state === 'future') item.classList.remove('future');
                        item._state = '';
                    }
                }
            }
        }
    };
    
    function refreshPhotoList(force) {
        if (force) showingPictureList = true;
        if (showingPictureList) {
            PhotoList.update();
            requestAnimFrame(refreshPhotoList);
        }
    }
    
    var scrollTime = 0.4;			//Scroll time
    var scrollDistance = 120;		//Distance. Use smaller value for shorter scroll and greater value for longer scroll
    $document.on('mousewheel DOMMouseScroll', function(e) {
        if (e.target.tagName.toLowerCase() != 'canvas') {
            e.preventDefault();
            $container = $(e.target).closest('.content');
            if ($container.is('#photos')) $container = $container.find('ul');

            var delta = e.originalEvent.wheelDelta/150 || -e.originalEvent.detail/3;
          
            var scrollTop = $container.scrollTop();
           	//console.log(scrollTop);
            var finalScroll = scrollTop - parseInt(delta*scrollDistance);
			//console.log(finalScroll);
			
//			$container.scrollTop(finalScroll);
//			var scrollTop = $container.scrollTop();
//			$container.animate({
//				transformOrigin:'left ' + -(scrollTop/10) + 'px'
//			},1000,'linear')
//			$body.animate({
//				backgroundPosition:'left ' + -(scrollTop/10) + 'px'
//			},1000,'linear')
			
            TweenLite.to($container, scrollTime, {
                scrollTo : { y: finalScroll, autoKill:true },
                ease: Power1.easeOut,
                overwrite: 5,
                onUpdate: function() {
                    if (Detector.webgl) {
                        var scrollTop = $container.scrollTop();
                        //console.log(scrollTop)
                        $container.css('transform-origin', 'left ' + -(scrollTop/10) + 'px');
                        $body.css('background-position', 'left ' + -(scrollTop/10) + 'px');
                    }
                }
            });
        }
    });
    

	var $video = $('#videos .player');
    var $behind = $('#behind-the-scenes .player');
    $document.on('click', '#videos a,#behind-the-scenes a', function() {
        var $this = $(this);
        var $player = $this.closest('#videos').length ? $video : $behind;
        $this.addClass('load');
       
        $player.find('iframe').attr('src', $this.data('url')).on('load',function() {
        	var _this = this;
        	setTimeout(function(){
        		if (_this.src.indexOf('img') != -1) return;//有img就返回,没有继续
	            var height = $player.parent().outerHeight()*.7;
	            $player.addClass('show').css('height', height);
	            $player.find('iframe').css('height', height);
	            var top = $player.closest('.content').scrollTop() + windowHeight*.1;
	            $player.css('top', top);
	            $this.removeClass('load');
	            
	            $player.find('iframe').off('load');
        	},800)
            
        });
        
        
        
    });
	
	$document.on('click', '.close', function(e) {
        if ($('.player.show').length) {
            $('.player').removeClass('show').removeAttr('style')
            .find('iframe').attr('src', '')
            
        } else {
        	
            toggleShip('remove');
        }
    });
	
	function showContent(id) {
        var $container = $("#" + id);
        if (id == 'photos') {
            $container.find('img[data-src]').each(function() {
                var url = $(this).data('thumb');
                $(this).attr('src', url);
            });
        } else {
            $container.find('img[data-src]').each(function() {
                var url = $(this).data('src');
                $(this).attr('src', url).removeAttr('data-src');
            });
        }

        setTimeout(function() {
        	//console.log('showContent',id);
            $container.addClass('show');
            location.hash = "!" + id;
            toggleShip('show');
            if (id == 'photos')
                refreshPhotoList(true);
        }, 100);
    }
    
   	function toggleShip(force) {
        if ($('body').hasClass('ship') || force == 'remove') {
            $('.content.show').animate({ scrollTop: 0 }, 100);
            setTimeout(function() {
                $('.content').removeClass('show');
                $('body').removeClass('stoptransition').removeAttr('class style');
                location.hash = "!";
               
                if (Detector.webgl) {
                    setTimeout(function() {
                        render();
                    }, 1000);
                    setUpControls();
                    showingPictureList = false;
                }
            }, 90);
        } else {
            $('body').addClass('ship');
            setTimeout(function() {
                $('body').addClass('stoptransition')
            }, 1000);
            showingPic = true;
            if (Detector.webgl) {
                controls = null;
            }
        }
    }
	
	
	
	
})();
