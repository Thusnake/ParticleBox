const FOV = 40;
const NEARZ = 0.1, FARZ = 100;
let camera_lon = 0, camera_lat = 0, camera_distance = 2;
let camera_lon_velocity = 0, camera_lat_velocity = 0, camera_distance_velocity = 0;
let mouse_down = false;
const CAMERA_FRICTION = 0.02;

let number_of_particles = 1000;

let gravity = 0.0;
let center_point_mass = 0.0;
let center_point_anti_mass = 0.0;
let wall_mass = 10;
let point_mass = 0.1;
let air_resistance = false;
const min_speed = -0.1;
const max_speed = 0.1;

const vertices = [
  -1,-1,-1, 1,-1,-1, 1, 1,-1, -1, 1,-1,
  -1,-1, 1, 1,-1, 1, 1, 1, 1, -1, 1, 1,
  -1,-1,-1, -1, 1,-1, -1, 1, 1, -1,-1, 1,
  1,-1,-1, 1, 1,-1, 1, 1, 1, 1,-1, 1,
  -1,-1,-1, -1,-1, 1, 1,-1, 1, 1,-1,-1,
  -1, 1,-1, -1, 1, 1, 1, 1, 1, 1, 1,-1, 
];

const colors = [
  5,3,7, 5,3,7, 5,3,7, 5,3,7,
  1,1,3, 1,1,3, 1,1,3, 1,1,3,
  0,0,1, 0,0,1, 0,0,1, 0,0,1,
  1,0,0, 1,0,0, 1,0,0, 1,0,0,
  1,1,0, 1,1,0, 1,1,0, 1,1,0,
  0,1,0, 0,1,0, 0,1,0, 0,1,0
];

const indices = [
  0,1,2, 0,2,3, /*4,5,6, 4,6,7,*/
  8,9,10, 8,10,11, 12,13,14, 12,14,15,
  16,17,18, 16,18,19, 20,21,22, 20,22,23 
];

const indices_edges_only = [
  0,1, 1,2, 2,3, 3,0,
  8,9, 9,10, 10,11, 11,8,
  12,13, 13,14, 14,15, 15,12,
  16,17, 17,18, 18,19, 19,16,
  20,21, 21,22, 22,23, 23,20
]

const room_data = [];
for (let wall_index = 0; wall_index < 6 * 4; wall_index++) {
  room_data.push(
    vertices[wall_index*3 + 0],
    vertices[wall_index*3 + 1],
    vertices[wall_index*3 + 2]
  );

  room_data.push(0.25, 0.25, 0.25, 0.25);
}

let fpsDisplay: HTMLElement;
let fpsCache: number[] = [];
let fpsCacheTimestamp = 0;

let canvas: HTMLCanvasElement;
let gl: WebGL2RenderingContext;

let proj_matrix: number[];
let Pmatrix: WebGLUniformLocation;

let view_matrix: number[];
let Vmatrix: WebGLUniformLocation;

let mov_matrix: number[];
let Mmatrix: WebGLUniformLocation;

let room_wall_buffer: WebGLBuffer;
let room_index_buffer: WebGLBuffer;
let room_edges_index_buffer: WebGLBuffer;
let room_wall_vertex_array: WebGLVertexArrayObject;

let particle_position_buffers: [WebGLBuffer, WebGLBuffer];
let particle_position_vertex_arrays: WebGLVertexArrayObject[];

let position_attribute_pointer: number;
let color_attribute_pointer: number;

let particle_texture: WebGLTexture;
let wall_texture: WebGLTexture;

let wall_drawing_program: WebGLProgram;
let drawing_program: WebGLProgram;
let updating_program: WebGLProgram;

/**
 * Called once upon document load.
 * 
 * Sets up all the controls and the environment for WebGL.
 */
function main() {
  canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
  gl = canvas.getContext('webgl2', {alpha: false});

  if (gl === null) {
    alert('Unable to initialize WebGL. Your browser may not support it.');
    return;
  }

  // Initialize controls.
  canvas.onmousedown = (event: MouseEvent) => {
    if (event.button == 0) mouse_down = true;
  }

  canvas.onmouseup = (event: MouseEvent) => {
    if (event.button == 0) mouse_down = false;
  }

  canvas.onmousemove = (event: MouseEvent) => {
    if (mouse_down) {
      camera_lat += event.movementX / canvas.width * Math.PI % (Math.PI * 2.0);
      camera_lon += event.movementY / canvas.height * Math.PI % (Math.PI * 2.0);
      camera_lat_velocity = event.movementX / canvas.width * Math.PI % (Math.PI * 2.0);
      camera_lon_velocity = event.movementY / canvas.height * Math.PI % (Math.PI * 2.0);
    }
  }

  canvas.onwheel = (event: WheelEvent) => {
    camera_distance_velocity += event.deltaY / 150.0 / 16.0;
  }

  setInterval(() => {
    camera_lat_velocity -= Math.sign(camera_lat_velocity) * Math.min(Math.abs(camera_lat_velocity), CAMERA_FRICTION * 50.0 / 1000.0);
    camera_lon_velocity -= Math.sign(camera_lon_velocity) * Math.min(Math.abs(camera_lon_velocity), CAMERA_FRICTION * 50.0 / 1000.0);
    camera_distance_velocity -= Math.sign(camera_distance_velocity) * Math.min(Math.abs(camera_distance_velocity), CAMERA_FRICTION * 10 * 50.0 / 1000.0);
  }, 50)

  const containerSwitch = document.getElementsByClassName('container-switch')[0] as HTMLElement;
  const container = document.getElementsByClassName('slidecontainer')[0] as HTMLElement;
  containerSwitch.onclick = () => {
    container.style.display = container.style.display == 'block' ? 'none' : 'block';
    const containerSwitchImg = containerSwitch.getElementsByTagName('img')[0];
    containerSwitchImg.style.transform = `scaleX(${containerSwitchImg.style.transform == 'scaleX(-1)' ? '1' : '-1'})`;
  }

  const gravitySlider = document.getElementById('gravityRange') as HTMLInputElement;
  gravity = Number(gravitySlider.value) * 0.1;
  gravitySlider.oninput = (ev) => gravity = Number(gravitySlider.value) * 0.1;

  const centerPointMassSlider = document.getElementById('centerPointMassRange') as HTMLInputElement;
  center_point_mass = Number(centerPointMassSlider.value) * 100000000;
  centerPointMassSlider.oninput = (ev) => center_point_mass = Number(centerPointMassSlider.value) * 100000000;

  const pointMassSlider = document.getElementById('ballMassRange') as HTMLInputElement;
  pointMassSlider.oninput = (ev) => point_mass = 0.1 * Math.pow(10, Number(pointMassSlider.value)/40.0);

  const centerPointAntiMassSlider = document.getElementById('centerPointAntiMassRange') as HTMLInputElement;
  centerPointAntiMassSlider.oninput = (ev) => center_point_anti_mass = Number(centerPointAntiMassSlider.value) * 100000000;

  const numberOfParticlesInputApplyButton = document.getElementById('numberOfParticlesApply');
  numberOfParticlesInputApplyButton.onclick = () => {
    number_of_particles = Number((document.getElementById('numberOfParticlesInput') as HTMLInputElement).value);
    setup();
  }

  const airResistanceCheckbox = document.getElementById('airCheckbox') as HTMLInputElement;
  airResistanceCheckbox.onclick = () => {
    air_resistance = airResistanceCheckbox.checked;
  }

  fpsDisplay = document.getElementById('fpsDisplay');

  setup();
  
  window.requestAnimationFrame(draw);
}

/**
 * Sets up all the WebGL programs, buffers and VAOs needed for rendering.
 */
function setup() {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Initialize the room buffers.
  room_wall_buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, room_wall_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(room_data), gl.STREAM_DRAW);

  room_index_buffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, room_index_buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  room_edges_index_buffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, room_edges_index_buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices_edges_only), gl.STATIC_DRAW);

  // Initialize particle buffers.
  // Each particle buffer has a copy for double buffering.
  const particle_data = [];
  for (let i = 0; i < number_of_particles; i++) {
    // Initial position.
    particle_data.push(
      Math.random()*2 - 1,
      Math.random()*2 - 1,
      Math.random()*2 - 1
    );
  
    // Initial age.
    particle_data.push(0);
  
    // Initial velocity.
    particle_data.push(
      Math.random() * (max_speed - min_speed) + min_speed,
      Math.random() * (max_speed - min_speed) + min_speed,
      Math.random() * (max_speed - min_speed) + min_speed
    );
  
    // Initial color.
    particle_data.push(1,1,1,1);
  }

  particle_position_buffers = [gl.createBuffer(), gl.createBuffer()];
  for (const buffer of particle_position_buffers) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particle_data), gl.STREAM_DRAW);
  }

  // Create the programs.
  wall_drawing_program = createWallDrawingProgram();
  drawing_program = createDrawingProgram();
  updating_program = createUpdatingProgram();

  const wall_drawing_program_attributes = [
    {
      location: gl.getAttribLocation(wall_drawing_program, 'i_Position'),
      size: 3,
      type: gl.FLOAT
    },
    {
      location: gl.getAttribLocation(wall_drawing_program, 'i_Color'),
      size: 4,
      type: gl.FLOAT
    }
  ]

  room_wall_vertex_array = gl.createVertexArray();
  setupParticleBufferVertexArray(room_wall_vertex_array, room_wall_buffer, wall_drawing_program_attributes);

  // Initialize particle drawing program vertex arrays.
  const drawing_program_attributes = [
    {
      location: gl.getAttribLocation(drawing_program, 'i_Position'),
      size: 3,
      type: gl.FLOAT,
      divisor: 1
    },
    {
      location: gl.getAttribLocation(drawing_program, 'i_Age'),
      size: 1,
      type: gl.FLOAT,
      divisor: 1
    },
    {
      location: gl.getAttribLocation(drawing_program, 'i_Velocity'),
      size: 3,
      type: gl.FLOAT,
      divisor: 1
    },
    {
      location: gl.getAttribLocation(drawing_program, 'i_Color'),
      size: 4,
      type: gl.FLOAT,
      divisor: 1
    }
  ];

  // Initialize particle updating program vertex arrays.
  const updating_program_attributes = [
    {
      location: gl.getAttribLocation(updating_program, 'i_Position'),
      size: 3,
      type: gl.FLOAT
    },
    {
      location: gl.getAttribLocation(updating_program, 'i_Age'),
      size: 1,
      type: gl.FLOAT
    },
    {
      location: gl.getAttribLocation(updating_program, 'i_Velocity'),
      size: 3,
      type: gl.FLOAT
    },
    {
      location: gl.getAttribLocation(updating_program, 'i_Color'),
      size: 4,
      type: gl.FLOAT
    }
  ];

  // There are two vertex arrays for the drawing and two for the updating program.
  // That way we can do both double buffering and running both programs.
  particle_position_vertex_arrays = [
    gl.createVertexArray(),
    gl.createVertexArray(),
    gl.createVertexArray(),
    gl.createVertexArray()
  ];

  // Initialize particle billboard texture array.
  const texture_vertex_data = new Float32Array([
    1, 1,
    1, 1,

    -1, 1,
    0, 1,

    -1, -1,
    0, 0,

    1, 1,
    1, 1,

    -1, -1,
    0, 0,

    1, -1,
    1, 0
  ]);

  const texture_attrib_locations = [
    {
      location: gl.getAttribLocation(drawing_program, 'i_Coord'),
      size: 2,
      type: gl.FLOAT
    },
    {
      location: gl.getAttribLocation(drawing_program, 'i_TexCoord'),
      size: 2,
      type: gl.FLOAT
    }
  ];

  const texture_vertex_buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texture_vertex_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, texture_vertex_data, gl.STATIC_DRAW);

  // Bind buffers to vertex arrays.
  for (let i = 0; i < particle_position_vertex_arrays.length; i++) {
    if (i <= 1) { // Updating program VAOs.
      setupParticleBufferVertexArray(particle_position_vertex_arrays[i], particle_position_buffers[i % 2], updating_program_attributes);
    }
    else { // Drawing program VAOs.
      setupParticleBufferVertexArray(particle_position_vertex_arrays[i], particle_position_buffers[i % 2], drawing_program_attributes);
      setupParticleBufferVertexArray(particle_position_vertex_arrays[i], texture_vertex_buffer, texture_attrib_locations);
    }
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Create wall texture.
  wall_texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, wall_texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

  // Create particle texture.
  particle_texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, particle_texture);

  // Assign empty texture by default.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  // Load texture asynchronously.
  const texture_image = new Image();
  texture_image.src = 'particle_texture.png';
  texture_image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, particle_texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture_image);
    
    // Generate a mipmap for better scaling.
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  onWindowResize();
}

/**
 * Create a WebGL program for drawing of generic polygons.
 */
function createWallDrawingProgram() {
  const program = gl.createProgram();

  const vertex_shader = gl.createShader(gl.VERTEX_SHADER);
  const vertex_shader_code = 
  `uniform mat4 Vmatrix;
    uniform mat4 Pmatrix;
    uniform mat4 Mmatrix;

    attribute vec3 i_Position;
    attribute vec4 i_Color;
    
    varying vec3 v_Position;
    varying vec4 v_Color;

    void main(void) {
        gl_Position = Pmatrix*Vmatrix*Mmatrix*vec4(i_Position, 1.);
        v_Color = i_Color;
        v_Position = i_Position;
    }`;
  gl.shaderSource(vertex_shader, vertex_shader_code);
  gl.compileShader(vertex_shader);

  const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
  const fragment_shader_code = 
  `precision mediump float;
  
    varying vec3 v_Position;
    varying vec4 v_Color;

    void main(void) {
      gl_FragColor = v_Color;
    }`;
  gl.shaderSource(fragment_shader, fragment_shader_code);
  gl.compileShader(fragment_shader);

  gl.attachShader(program, vertex_shader);
  gl.attachShader(program, fragment_shader);
  gl.linkProgram(program);
  return program;
}

/**
 * Create a WebGL program for drawing particles.
 */
function createDrawingProgram() {
  const vertCode = 
   `uniform mat4 Vmatrix;
    uniform mat4 Pmatrix;
    uniform mat4 Mmatrix;
    uniform float u_SqRtPointMass;

    attribute vec3 i_Position;
    attribute float i_Age;
    attribute vec3 i_Velocity;
    attribute vec4 i_Color;

    attribute vec2 i_Coord;
    attribute vec2 i_TexCoord;
    
    varying vec3 v_Position;
    varying float v_Age;
    varying vec3 v_Velocity;
    varying vec4 v_Color;
    varying vec2 v_TexCoord;

    #define M_PI 3.1415926535897932384626433832795

    void main(void) {
      float density = 1000.0;
      float scale = u_SqRtPointMass / 31.6 / M_PI;
      vec3 cam_right = vec3(Vmatrix[0].x, Vmatrix[1].x, Vmatrix[2].x);
      vec3 cam_up = vec3(Vmatrix[0].y, Vmatrix[1].y, Vmatrix[2].y);
      vec3 local_coord_facing_cam = (cam_right * i_Coord.x) + (cam_up * i_Coord.y);

      vec3 vert_coord = i_Position + scale * local_coord_facing_cam;

      gl_Position = Pmatrix*Vmatrix*Mmatrix*vec4(vert_coord, 1.);
      // gl_PointSize = (1.0 / (1.1 + gl_Position[2])) * 12.0;

      v_Color = i_Color;
      v_Position = i_Position;
      v_Age = i_Age;
      v_Velocity = i_Velocity;
      v_TexCoord = i_TexCoord;
    }`;
  
  const fragCode = `precision mediump float;
    uniform sampler2D u_Texture;
  
    varying vec3 v_Position;
    varying float v_Age;
    varying vec3 v_Velocity;
    varying vec4 v_Color;
    varying vec2 v_TexCoord;

    void main(void) {
      gl_FragColor = v_Color * texture2D(u_Texture, v_TexCoord);
    }`;
  
  const vertShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertShader, vertCode);
  gl.compileShader(vertShader);
  
  const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragShader, fragCode);
  gl.compileShader(fragShader);
  
  const program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  Pmatrix = gl.getUniformLocation(program, 'Pmatrix');
  Vmatrix = gl.getUniformLocation(program, 'Vmatrix');
  Mmatrix = gl.getUniformLocation(program, 'Mmatrix');

  mov_matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  view_matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  
  return program;
}

/**
 * Create a WebGL program for updating particles.
 */
function createUpdatingProgram() {
  const program = gl.createProgram();
  
  const vertex_shader = gl.createShader(gl.VERTEX_SHADER);
  const vertex_shader_code = 
   `precision mediump float;
    
    uniform float u_TimeDelta;
    uniform vec3 u_Gravity;
    uniform float u_CenterPointMass;
    uniform float u_CenterPointAntiMass;
    uniform float u_MinSpeed;
    uniform float u_MaxSpeed;
    uniform float u_WallMass;
    uniform float u_PointMass;
    uniform float u_AirResistance;

    attribute vec3 i_Position;
    attribute float i_Age;
    attribute vec3 i_Velocity;
    attribute vec4 i_Color;

    varying vec3 v_Position;
    varying float v_Age;
    varying vec3 v_Velocity;
    varying vec4 v_Color;

    void main(void) {
      float point_mass_gravity = u_PointMass * u_AirResistance;
      if (point_mass_gravity == 0.0) point_mass_gravity = 1.0;

      v_Position = i_Position + i_Velocity * u_TimeDelta;
      v_Age = i_Age + u_TimeDelta;
      v_Velocity = i_Velocity + u_Gravity * point_mass_gravity * u_TimeDelta;

      for (int i=0; i<3; i++) {
        if (v_Position[i] > 1.0 || v_Position[i] < -1.0) {
          v_Velocity[i] = v_Velocity[i] * (u_PointMass - u_WallMass) / (u_PointMass + u_WallMass);
          if (v_Position[i] > 1.0) v_Position[i] = 2.0 - v_Position[i];
          else if (v_Position[i] < -1.0) v_Position[i] = -2.0 - v_Position[i];
        }
      }

      float distance_to_center = max(distance(v_Position, vec3(0.0, 0.0, 0.0)), 0.1);
      float gravitational_constant = 6.674 * pow(10.0, -11.0);
      float force = u_CenterPointMass * point_mass_gravity * gravitational_constant / pow(distance_to_center, 2.0);
      vec3 center_force = normalize(vec3(0.0, 0.0, 0.0) - v_Position) * force;

      float fake_anti_force = u_CenterPointAntiMass * gravitational_constant / pow(distance_to_center, 4.0);
      vec3 center_fake_anti_force = normalize(vec3(0.0, 0.0, 0.0) - v_Position) * fake_anti_force * -1.0;
      
      v_Velocity = v_Velocity + center_force * u_TimeDelta + center_fake_anti_force * u_TimeDelta;

      v_Color = i_Color;
    }`;
  
  gl.shaderSource(vertex_shader, vertex_shader_code);
  gl.compileShader(vertex_shader);

  const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
  const fragment_shader_code = 
   `precision mediump float;
   
    varying vec3 v_Position;
    varying float v_Age;
    varying vec3 v_Velocity;
    varying vec4 v_Color;
    
    void main(void) {
    }`;

  gl.shaderSource(fragment_shader, fragment_shader_code);
  gl.compileShader(fragment_shader);

  gl.transformFeedbackVaryings(
    program, 
    [
      'v_Position',
      'v_Age',
      'v_Velocity',
      'v_Color'
    ],
    gl.INTERLEAVED_ATTRIBS
  );

  gl.attachShader(program, vertex_shader);
  gl.attachShader(program, fragment_shader);
  gl.linkProgram(program);
  return program;
}

/**
 * Sets up a VAO.
 * @param vertex_array The vertex array to be set up.
 * @param buffer The buffer to be linked to the VAO.
 * @param attributes An array describing what attributes are interleaved in the
 *                   buffer for each vertex.
 */
function setupParticleBufferVertexArray(vertex_array: WebGLVertexArrayObject,
                                        buffer: WebGLBuffer,
                                        attributes: {
                                          location: number,
                                          size: number,
                                          type: number,
                                          divisor?: number
                                        }[]) {
  gl.bindVertexArray(vertex_array);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  let offset = 0;
  const stride = attributes.map((a: {location: number, size: number, type: number}) => a.size).reduce((a, b) => a + b);
  for (const attribute of attributes) {
    gl.enableVertexAttribArray(attribute.location);
    gl.vertexAttribPointer(
      attribute.location,
      attribute.size,
      attribute.type,
      false, 
      4*stride,
      offset
    );

    offset += attribute.size * 4;

    if (attribute.hasOwnProperty("divisor")) {
      gl.vertexAttribDivisor(attribute.location, attribute.divisor);
    }
  }
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

let old_timestamp = 0;
let read_index = 0, write_index = 1;

/**
 * Draws a single frame of the scene and updates all of the particles in the scene.
 * @param timestamp Time at which the draw call is executed.
 */
function draw(timestamp: number) {
  // Slide the camera around if it has retained some velocity.
  if (!mouse_down) {
    camera_lat += camera_lat_velocity;
    camera_lon += camera_lon_velocity;
  }
  camera_distance += camera_distance_velocity;

  // Compute the view matrix for the new camera position.
  compute_view_matrix();

  gl.disable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, particle_texture);

  // Calculate the delta time (time between frames) from timestamps.
  const dt = (timestamp - old_timestamp < 500 ? timestamp - old_timestamp : 0.001) / 1000.0;
  old_timestamp = timestamp;
  fpsCache.push(1.0 / dt);
  if (timestamp - fpsCacheTimestamp > 1000) {
    fpsDisplay.innerText = String(Math.round(fpsCache.reduce((a, b) => a + b) / fpsCache.length));
    fpsCache = [];
    fpsCacheTimestamp = timestamp;
  }

  // Update the particles.
  gl.useProgram(updating_program);
  gl.uniform1f(gl.getUniformLocation(updating_program, 'u_TimeDelta'), dt);
  gl.uniform3f(gl.getUniformLocation(updating_program, 'u_Gravity'), 0, -gravity, 0);
  gl.uniform1f(gl.getUniformLocation(updating_program, 'u_CenterPointMass'), center_point_mass);
  gl.uniform1f(gl.getUniformLocation(updating_program, 'u_CenterPointAntiMass'), center_point_anti_mass);
  gl.uniform1f(gl.getUniformLocation(updating_program, 'u_MinSpeed'), min_speed);
  gl.uniform1f(gl.getUniformLocation(updating_program, 'u_MaxSpeed'), max_speed);
  gl.uniform1f(gl.getUniformLocation(updating_program, 'u_WallMass'), wall_mass);
  gl.uniform1f(gl.getUniformLocation(updating_program, 'u_PointMass'), point_mass);
  gl.uniform1f(gl.getUniformLocation(updating_program, 'u_AirResistance'), air_resistance ? 1 : 0);

  gl.bindVertexArray(particle_position_vertex_arrays[read_index]);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, particle_position_buffers[write_index]);

  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, number_of_particles);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);

  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
  gl.bindVertexArray(null);

  // Draw the room.
  gl.useProgram(wall_drawing_program);
  gl.viewport(0.0, 0.0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(gl.getUniformLocation(wall_drawing_program, 'Pmatrix'), false, proj_matrix);
  gl.uniformMatrix4fv(gl.getUniformLocation(wall_drawing_program, 'Vmatrix'), false, view_matrix);
  gl.uniformMatrix4fv(gl.getUniformLocation(wall_drawing_program, 'Mmatrix'), false, mov_matrix);

  gl.bindVertexArray(room_wall_vertex_array);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, room_index_buffer);
  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, room_edges_index_buffer);
  gl.drawElements(gl.LINES, indices_edges_only.length, gl.UNSIGNED_SHORT, 0);

  // Draw the particles.
  gl.useProgram(drawing_program);
  gl.uniformMatrix4fv(Pmatrix, false, proj_matrix);
  gl.uniformMatrix4fv(Vmatrix, false, view_matrix);
  gl.uniformMatrix4fv(Mmatrix, false, mov_matrix);
  gl.uniform1i(gl.getUniformLocation(drawing_program, 'u_Texture'), 0);
  gl.uniform1f(gl.getUniformLocation(drawing_program, 'u_SqRtPointMass'), Math.sqrt(point_mass));

  gl.bindVertexArray(particle_position_vertex_arrays[read_index + 2]);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, number_of_particles);
  gl.bindVertexArray(null);

  // Swap the read and write indices for double buffering.
  read_index = read_index === 0 ? 1 : 0;
  write_index = write_index === 0 ? 1 : 0;

  // Request the next frame.
  window.requestAnimationFrame(draw);
}

/**
 * Calculates a (frustum) projection matrix.
 * @param angle Field of view angle.
 * @param whRatio Screen width to height ratio.
 * @param zMin The Z value of the nearest visible plane.
 * @param zMax The Z value of the furthest visible plane.
 */
function get_projection(angle: number, whRatio: number, zMin: number,
                        zMax: number) {
  let ang = Math.tan((angle * .5) * Math.PI / 180);
  return [
    0.5/ang, 0, 0, 0,
    0, 0.5*whRatio/ang, 0, 0,
    0, 0, -(zMax+zMin)/(zMax-zMin), -1,
    0, 0, (-2*zMax*zMin)/(zMax-zMin), 0
  ];
}

/**
 * Calculates a view matrix from the current camera position looking towards the
 * origin.
 */
function compute_view_matrix(): void {
  const cam_pos: [number, number, number] = [
    camera_distance * Math.sin(camera_lat) * -Math.cos(camera_lon),
    camera_distance * Math.sin(camera_lon),
    camera_distance * Math.cos(camera_lat) * Math.cos(camera_lon)
  ];
  view_matrix = inverse(look_at(cam_pos, [0, 0, 0], [0, 1*Math.cos(camera_lon), 0]))
}

function look_at(cam_pos: [number, number, number],
                 target: [number, number, number],
                 up: [number, number, number]) {
  const zAxis = normalize(subtract_vectors(cam_pos, target));
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = normalize(cross(zAxis, xAxis));

  return [
     xAxis[0], xAxis[1], xAxis[2], 0,
     yAxis[0], yAxis[1], yAxis[2], 0,
     zAxis[0], zAxis[1], zAxis[2], 0,
     cam_pos[0], cam_pos[1], cam_pos[2], 1
  ];
}

function onWindowResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  proj_matrix = get_projection(FOV, canvas.width/canvas.height, NEARZ, FARZ);
}

/***** Matrix and vector helper functions. *****/

function subtract_vectors(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function normalize(v: [number, number, number]): [number, number, number] {
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return length > 0.00001 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
}

function cross(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0]];
}

function inverse(m: number[]) {
  const m00 = m[0*4+0], m01 = m[0*4+1], m02 = m[0*4+2], m03 = m[0*4+3];
  const m10 = m[1*4+0], m11 = m[1*4+1], m12 = m[1*4+2], m13 = m[1*4+3];
  const m20 = m[2*4+0], m21 = m[2*4+1], m22 = m[2*4+2], m23 = m[2*4+3];
  const m30 = m[3*4+0], m31 = m[3*4+1], m32 = m[3*4+2], m33 = m[3*4+3];
  const tmp_0 = m22 * m33, tmp_1 = m32 * m23, tmp_2 = m12 * m33,
        tmp_3 = m32 * m13, tmp_4 = m12 * m23, tmp_5 = m22 * m13,
        tmp_6 = m02 * m33, tmp_7 = m32 * m03, tmp_8 = m02 * m23,
        tmp_9 = m22 * m03, tmp_10 = m02 * m13, tmp_11 = m12 * m03,
        tmp_12 = m20 * m31, tmp_13 = m30 * m21, tmp_14 = m10 * m31,
        tmp_15 = m30 * m11, tmp_16 = m10 * m21, tmp_17 = m20 * m11,
        tmp_18 = m00 * m31, tmp_19 = m30 * m01, tmp_20 = m00 * m21,
        tmp_21 = m20 * m01, tmp_22 = m00 * m11, tmp_23 = m10 * m01;

  const t0 = (tmp_0 * m11 + tmp_3 * m21 + tmp_4 * m31) -
      (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
  const t1 = (tmp_1 * m01 + tmp_6 * m21 + tmp_9 * m31) -
      (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
  const t2 = (tmp_2 * m01 + tmp_7 * m11 + tmp_10 * m31) -
      (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
  const t3 = (tmp_5 * m01 + tmp_8 * m11 + tmp_11 * m21) -
      (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);

  const d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);

  return [
    d * t0,
    d * t1,
    d * t2,
    d * t3,
    d * ((tmp_1 * m10 + tmp_2 * m20 + tmp_5 * m30) -
          (tmp_0 * m10 + tmp_3 * m20 + tmp_4 * m30)),
    d * ((tmp_0 * m00 + tmp_7 * m20 + tmp_8 * m30) -
          (tmp_1 * m00 + tmp_6 * m20 + tmp_9 * m30)),
    d * ((tmp_3 * m00 + tmp_6 * m10 + tmp_11 * m30) -
          (tmp_2 * m00 + tmp_7 * m10 + tmp_10 * m30)),
    d * ((tmp_4 * m00 + tmp_9 * m10 + tmp_10 * m20) -
          (tmp_5 * m00 + tmp_8 * m10 + tmp_11 * m20)),
    d * ((tmp_12 * m13 + tmp_15 * m23 + tmp_16 * m33) -
          (tmp_13 * m13 + tmp_14 * m23 + tmp_17 * m33)),
    d * ((tmp_13 * m03 + tmp_18 * m23 + tmp_21 * m33) -
          (tmp_12 * m03 + tmp_19 * m23 + tmp_20 * m33)),
    d * ((tmp_14 * m03 + tmp_19 * m13 + tmp_22 * m33) -
          (tmp_15 * m03 + tmp_18 * m13 + tmp_23 * m33)),
    d * ((tmp_17 * m03 + tmp_20 * m13 + tmp_23 * m23) -
          (tmp_16 * m03 + tmp_21 * m13 + tmp_22 * m23)),
    d * ((tmp_14 * m22 + tmp_17 * m32 + tmp_13 * m12) -
          (tmp_16 * m32 + tmp_12 * m12 + tmp_15 * m22)),
    d * ((tmp_20 * m32 + tmp_12 * m02 + tmp_19 * m22) -
          (tmp_18 * m22 + tmp_21 * m32 + tmp_13 * m02)),
    d * ((tmp_18 * m12 + tmp_23 * m32 + tmp_15 * m02) -
          (tmp_22 * m32 + tmp_14 * m02 + tmp_19 * m12)),
    d * ((tmp_22 * m22 + tmp_16 * m02 + tmp_21 * m12) -
          (tmp_20 * m12 + tmp_23 * m22 + tmp_17 * m02))
  ];
}

