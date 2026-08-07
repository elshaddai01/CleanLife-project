const express= require('express');
const router = express.Router();

const { pool} = require(' ./db/pool');
//const{requireAuth}=require('../ middleware/auth');

router.get('/' , async(req, res)=>{});

try{
    const userId = req.user.id;

    const results= await pool.query(
        `
        SELECT*
        FROM users
        `
    );
    res.json(results.rows);
} catch(error){
    res.status(500).json({
        message:"server error"
    }
    );
}
router.get('/', async(req, res)=>{
    const results = await pool.query(
        `
        SELECT *
         FROM users
         `
    );
    res.json(results.rows);
});
module.exports = router;