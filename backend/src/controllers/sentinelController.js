const {
  getCameraCatalogue,
} = require("../services/sentinelService");

const pool = require("../config/database");

// ==========================================
// GET SENTINEL CAMERA CATALOGUE
// ==========================================

const getSentinelCameras = async (req, res) => {
  try {
    const data = await getCameraCatalogue();

    res.json({
      success: true,
      source: "Sentinel Sandbox",
      cameraCount: data.cameras?.length || 0,
      cameras: data.cameras || [],
    });
  } catch (error) {
    console.error("Sentinel catalogue error:", error.message);

    res.status(502).json({
      success: false,
      message: "Unable to retrieve Sentinel camera catalogue",
      error: error.message,
    });
  }
};

// ==========================================
// SYNC SENTINEL CAMERAS
// ==========================================

const syncSentinelCameras = async (req, res) => {
  try {
    const data = await getCameraCatalogue();
    const cameras = data.cameras || [];

    let created = 0;
    let updated = 0;
    let streamsSynced = 0;

    for (const camera of cameras) {
      const cameraId = `SENTINEL-${camera.id}`;

      // ------------------------------------------
      // FIND CAMERA
      // ------------------------------------------

      const existing = await pool.query(
        `SELECT id FROM cameras WHERE camera_id = $1`,
        [cameraId]
      );

      let dbCameraId;

      // ------------------------------------------
      // CREATE CAMERA
      // ------------------------------------------

      if (existing.rows.length === 0) {
        const result = await pool.query(
          `
          INSERT INTO cameras (
            camera_id,
            name,
            camera_type,
            vendor,
            ownership,
            location_name,
            latitude,
            longitude,
            connectivity,
            status
          )
          VALUES (
            $1::varchar,
            $2::varchar,
            'IP',
            'Sentinel',
            'Government',
            $3::varchar,
            NULL,
            NULL,
            'RTSP',
            $4::varchar
          )
          RETURNING id
          `,
          [
            cameraId,
            camera.name || `Sentinel Camera ${camera.id}`,
            camera.location || null,
            camera.live ? "DISCOVERED" : "OFFLINE",
          ]
        );

        dbCameraId = result.rows[0].id;
        created++;
      }

      // ------------------------------------------
      // UPDATE CAMERA
      // ------------------------------------------

      else {
        dbCameraId = existing.rows[0].id;

        await pool.query(
          `
          UPDATE cameras
          SET
            name = $1::varchar,
            location_name = $2::varchar,
            status = $3::varchar,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $4::uuid
          `,
          [
            camera.name || `Sentinel Camera ${camera.id}`,
            camera.location || null,
            camera.live ? "DISCOVERED" : "OFFLINE",
            dbCameraId,
          ]
        );

        updated++;
      }

      // ------------------------------------------
      // STREAM VALUES
      // ------------------------------------------

      const resolution =
        camera.width > 0 && camera.height > 0
          ? `${camera.width}x${camera.height}`
          : null;

      const fps =
        Number(camera.fps) > 0
          ? Math.round(Number(camera.fps))
          : null;

      const width =
        Number(camera.width) > 0
          ? Number(camera.width)
          : null;

      const height =
        Number(camera.height) > 0
          ? Number(camera.height)
          : null;

      const bitrate =
        Number(camera.bitrate_kbps) > 0
          ? Number(camera.bitrate_kbps)
          : null;

      const bitsPerPixel =
        Number(camera.bits_per_pixel) > 0
          ? Number(camera.bits_per_pixel)
          : null;

      // ------------------------------------------
      // UPSERT STREAM
      // ------------------------------------------

      await pool.query(
        `
        INSERT INTO streams (
          camera_id,
          protocol,
          stream_url,
          stream_type,
          resolution,
          fps,
          status,
          rtsp_url,
          webrtc_url,
          hls_url,
          codec,
          width,
          height,
          bitrate_kbps,
          bits_per_pixel,
          source
        )
        VALUES (
          $1::uuid,
          'RTSP',
          $2::text,
          'LIVE',
          $3::varchar,
          $4::integer,
          $5::varchar,
          $2::text,
          $6::text,
          $7::text,
          $8::varchar,
          $9::integer,
          $10::integer,
          $11::integer,
          $12::numeric,
          'SENTINEL'
        )
        ON CONFLICT (camera_id, protocol)
        DO UPDATE SET
          stream_url = EXCLUDED.stream_url,
          resolution = EXCLUDED.resolution,
          fps = EXCLUDED.fps,
          status = EXCLUDED.status,
          rtsp_url = EXCLUDED.rtsp_url,
          webrtc_url = EXCLUDED.webrtc_url,
          hls_url = EXCLUDED.hls_url,
          codec = EXCLUDED.codec,
          width = EXCLUDED.width,
          height = EXCLUDED.height,
          bitrate_kbps = EXCLUDED.bitrate_kbps,
          bits_per_pixel = EXCLUDED.bits_per_pixel
        `,
        [
          dbCameraId,
          camera.rtsp_url || null,
          resolution,
          fps,
          camera.live ? "DISCOVERED" : "OFFLINE",
          camera.webrtc_url || null,
          camera.hls_live_url || null,
          camera.codec || null,
          width,
          height,
          bitrate,
          bitsPerPixel,
        ]
      );

      streamsSynced++;

      // ------------------------------------------
      // CAMERA HEALTH
      // ------------------------------------------

      await pool.query(
        `
        INSERT INTO camera_health (
          camera_id,
          status,
          last_seen
        )
        VALUES (
          $1::uuid,
          $2::varchar,
          CASE
            WHEN $2::varchar = 'ONLINE'
            THEN CURRENT_TIMESTAMP
            ELSE NULL
          END
        )
        `,
        [
          dbCameraId,
          camera.live ? "DISCOVERED" : "OFFLINE",
        ]
      );
    }

    res.json({
      success: true,
      message: "Sentinel camera synchronization completed",
      total: cameras.length,
      created,
      updated,
      streamsSynced,
    });

  } catch (error) {
    console.error("Sentinel sync error:", error);

    res.status(500).json({
      success: false,
      message: "Sentinel synchronization failed",
      error: error.message,
    });
  }
};

module.exports = {
  getSentinelCameras,
  syncSentinelCameras,
};
