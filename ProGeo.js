#pragma strict

import System.Collections.Generic;

//----------------------------------------
//  Various procedural geometry tools
//----------------------------------------

//----------------------------------------
//  This only exists because Unity's Mesh class has a lot of overhead
//	when reading its read-only buffers. So keep a copy in this class, modify it,
//	then copy it to the Mesh when you're done.
//----------------------------------------
class MeshBuffer
{
	var vertices:Vector3[] = null;
	var uv:Vector2[] = null;
	var normals:Vector3[] = null;
	var triangles:int[];

	function Allocate( numVerts:int, numTris:int )
	{
		vertices = new Vector3[ numVerts ];
		uv = new Vector2[ numVerts ];
		normals = new Vector3[ numVerts ];
		triangles = new int[ 3*numTris ];
	}

	function CopyToMesh( to:Mesh )
	{
		// as of Unity 3.5.4, it actually checks for integrity, so we need to clear the mesh's tris before setting other stuff
		to.triangles = null;
		to.vertices = vertices;
		to.uv = uv;
		to.normals = normals;
		to.triangles = triangles;
	}

    function SetAllNormals(n:Vector3)
    {
        for( var i = 0; i < normals.length; i++ )
        {
            normals[i] = n;
        }
    }
}

//----------------------------------------
//  Works in the XY plane, and basically uses XY position as UVs
//	TODO - have two radii - left and right radius
//----------------------------------------
static function Stroke2D(
		ctrlPts:Vector2[],
		ctrlPtTexVs:float[],	// texture coordinate (V's) 
		firstCtrl:int, lastCtrl:int,	// use first/lastCtrl to select a sub-array of ctrlPts.
		isLoop:boolean,	// whether or not it's a closed loop, ie. we should connect the last ctrl to the first one
		width:float, mesh:MeshBuffer,
		firstVert:int, firstTri:int	// use firstVert/Tri to tell Stroke2D where to output in the mesh. firstTri should be the index/3
		)
{
	if( lastCtrl <= firstCtrl ) {
		Debug.LogError('need at least 2 points to build stroke geometry!');
		return;
	}

	var nctrls = lastCtrl-firstCtrl+1;
	var radius : float = width/2.0;
	var nsegs = ( isLoop ? nctrls : nctrls-1 );
	var ntris = 2*nsegs;

	// make sure buffers are large enough
	if( (firstVert + 2*nctrls) > mesh.vertices.length ) {
		Debug.LogError('not enough vertices allocated in mesh for '+nctrls+' control points!');
		return;
	}

	if( 3*(firstTri + ntris) > mesh.triangles.length ) {
		Debug.LogError('not enough triangle space allocated in mesh for '+nctrls+' control points!');
		return;
	}

	// first ctrl
	if( !isLoop )
    {
		var a = ctrlPts[firstCtrl];
		var b = ctrlPts[firstCtrl+1];
		var e0 = b-a;
		var n = Math2D.PerpCCW( e0 ).normalized;
		mesh.vertices[firstVert+0] = a + n*radius;
		mesh.vertices[firstVert+1] = a - n*radius;
		var v = ctrlPtTexVs[ firstCtrl ];
		mesh.uv[ firstVert+0 ] = Vector2( 0, v );
		mesh.uv[ firstVert+1 ] = Vector2( 1, v );
	}

	for( var i = (isLoop ? firstCtrl : firstCtrl+1);
			i < (isLoop ? lastCtrl+1 : lastCtrl); i++ )
	{
		var p0 = ctrlPts[(nctrls+i-1) % nctrls];
		var p1 = ctrlPts[i % nctrls];
		var p2 = ctrlPts[(i+1) % nctrls];
		e0 = p1-p0;
		var e1 = p2-p1;

        var n0 = Math2D.PerpCCW(e0.normalized);
        var n1 = Math2D.PerpCCW(e1.normalized);
        var theta = Mathf.Acos(Vector2.Dot(n0,n1)) * 0.5;
        var cosTheta = Mathf.Cos(theta);
        var diagLen = radius;
        var diagDir = ((n0+n1) * 0.5).normalized;

        if( cosTheta >= 1e-7 )
        {
            diagLen = radius / cosTheta;
        }

        var vi0 = firstVert + 2*i + 0;
        var vi1 = firstVert + 2*i + 1;
		mesh.vertices[ vi0 ] = p1 + diagDir*diagLen;
		mesh.vertices[ vi1 ] = p1 - diagDir*diagLen;

        // FIXME: there's a bug with UVs.. the first seg gets a full 0-1

		v = ctrlPtTexVs[ i % nctrls ];
		mesh.uv[ vi0 ] = Vector2( 0, v );
		mesh.uv[ vi1 ] = Vector2( 1, v );
	}

	// last one
	if( !isLoop ) {
		a = ctrlPts[ lastCtrl-1 ];
		b = ctrlPts[ lastCtrl ];
		e0 = b-a;
		n = Math2D.PerpCCW( e0 ).normalized;
		mesh.vertices[ firstVert+2*nctrls-2 ] = b + n*radius;
		mesh.vertices[ firstVert+2*nctrls-1 ] = b - n*radius;
		v = ctrlPtTexVs[ lastCtrl ];
		mesh.uv[ firstVert+2*nctrls-2 ] = Vector2( 0, v );
		mesh.uv[ firstVert+2*nctrls-1 ] = Vector2( 1, v );
	}

	//----------------------------------------
	//  Triangles
	//----------------------------------------
	for( i = 0; i < (nctrls-1); i++ )
	{
		mesh.triangles[ 3*firstTri + 6*i + 0 ] = firstVert + 2 * i + 0;
		mesh.triangles[ 3*firstTri + 6*i + 1 ] = firstVert + 2 * i + 2;
		mesh.triangles[ 3*firstTri + 6*i + 2 ] = firstVert + 2 * i + 1;

		mesh.triangles[ 3*firstTri + 6*i + 3 ] = firstVert + 2 * i + 1;
		mesh.triangles[ 3*firstTri + 6*i + 4 ] = firstVert + 2 * i + 2;
		mesh.triangles[ 3*firstTri + 6*i + 5 ] = firstVert + 2 * i + 3;
/*
        DebugTriangle(
                mesh.vertices[ firstVert + 2 * i + 0 ],
                mesh.vertices[ firstVert + 2 * i + 2 ],
                mesh.vertices[ firstVert + 2 * i + 1 ], Color.red);

        DebugTriangle(
                mesh.vertices[ firstVert + 2 * i + 1 ],
                mesh.vertices[ firstVert + 2 * i + 2 ],
                mesh.vertices[ firstVert + 2 * i + 3 ], Color.blue);
*/
	}

	if( isLoop )
    {
		i = nctrls-1;
		mesh.triangles[ 3*firstTri + 6*i + 0 ] = firstVert + 2 * i + 0;
		mesh.triangles[ 3*firstTri + 6*i + 1 ] = firstVert + 2 * 0 + 0;
		mesh.triangles[ 3*firstTri + 6*i + 2 ] = firstVert + 2 * i + 1;

		mesh.triangles[ 3*firstTri + 6*i + 3 ] = firstVert + 2 * i + 1;
		mesh.triangles[ 3*firstTri + 6*i + 4 ] = firstVert + 2 * 0 + 0;
		mesh.triangles[ 3*firstTri + 6*i + 5 ] = firstVert + 2 * 0 + 1;
	}

}

static function DebugTriangle( p0:Vector3, p1:Vector3, p2:Vector3, c:Color )
{
    Debug.DrawLine(p0, p1, c);
    Debug.DrawLine(p1, p2, c);
    Debug.DrawLine(p2, p0, c);
}

//----------------------------------------
//  pts - the ordered points of a closed polygon
//----------------------------------------
static function ClipByLine(
		pts:Vector2[],
		l0:Vector2,
		l1:Vector2,
		keepRight:boolean )
		: Array
{
	var npts = pts.length;

	if( !keepRight )
	{
		// just swap the two
		var temp = l0;
		l0 = l1;
		l1 = temp;
	}

	var lineDir = (l1-l0).normalized;
	var rightDir = -1 * Math2D.PerpCCW( lineDir ).normalized;

	// figure out which line segs cross the line
	var ptIsOnRight = new boolean[ npts ];
	
	for( var i = 0; i < npts; i++ )
	{
		var toPt = (pts[i] - l0).normalized;
		ptIsOnRight[i] = (Vector2.Dot( toPt, rightDir ) > 0 );
	}

	var segCrosses = new boolean[npts];
	for( i = 0; i < npts; i++ )
	{
		if( ptIsOnRight[i] != ptIsOnRight[(i+1)%npts] )
			segCrosses[i] = true;
		else
			segCrosses[i] = false;
	}

	//----------------------------------------
	//  Now perform the generation of the new polygon
	//	Pretty simple logic.
	//----------------------------------------
	var newPts = new Array();

	for( i = 0; i < npts; i++ )
	{
		if( ptIsOnRight[i] )
			newPts.Push( pts[i] );

		if( segCrosses[i] )
		{
			// add the intersection point
			var p0 = pts[i];
			var p1 = pts[(i+1)%npts];
			var intx = Math2D.Intersect2DLines( l0, l1, p0, p1 );
			newPts.Push(intx);
		}
	}

	return newPts;
}

static function CompareByXThenY( a:Vector2, b:Vector2 ) 
{
	if( a.x == b.x ) {
		// order by Y coordinate instead
		return Mathf.RoundToInt( Mathf.Sign( a.y - b.y ) );
	}
	else
		return Mathf.RoundToInt( Mathf.Sign( a.x - b.x ) );
}

//----------------------------------------
//	For Moments of Reflection, perhaps the best rep of the level geometry is a SET of polygons rather than a single polygon (which is wrong) or a 2D mesh (which is overly general)
//----------------------------------------
class Mesh2D
{
	var pts : Vector2[] = null;
	var edgeA : int[] = null;
	var edgeB : int[] = null;

	function Duplicate() : Mesh2D
	{
		var dupe = new Mesh2D();
		dupe.pts = Utils.Duplicate( pts );
		dupe.edgeA = Utils.Duplicate( edgeA );
		dupe.edgeB = Utils.Duplicate( edgeB );
		return dupe;
	}

	function GetNumVertices() : int { return pts.length; }
	function GetNumEdges() : int { return edgeA.length; }

    function GetEdgeStart(edge:int) : Vector2 { return pts[ edgeA[edge] ]; }
    function GetEdgeEnd(edge:int) : Vector2 { return pts[ edgeB[edge] ]; }

	function DebugDraw( color:Color, dur:float )
	{
		for( var e = 0; e < edgeA.length; e++ )
		{
			var a = edgeA[e];
			var b = edgeB[e];
			Debug.DrawLine( Utils.ToVector3( pts[a]), Utils.ToVector3(pts[b]), color, dur, false );
		}
	}

	function ScalePoints( s:float )
	{
		if( pts != null ) {
			for( var i = 0; i < pts.length; i++ )
				pts[i] *= s;
		}
	}

	//----------------------------------------
	//  Reflects along the given line
	//	keepRight - which side of the line should be kept
	//	This adds new edges with proper orientation
    //  mirrorOrientation - if true, then orientation will be _mirrored_ instead of consistent
	//----------------------------------------
	function Reflect( l0:Vector2, l1:Vector2, keepRight:boolean, mirrorOrientation:boolean )
	{
		var npts = pts.length;
		var i = 0;

		if( !keepRight )
		{
			// just swap the two
			var temp = l0;
			l0 = l1;
			l1 = temp;
		}
		var lineDir = (l1-l0).normalized;
		var rightDir = -1 * Math2D.PerpCCW( lineDir ).normalized;

		// see which points are on the right side
		var ptIsOnRight = new boolean[ npts ];
		for( i = 0; i < npts; i++ )
		{
			var toPt = (pts[i] - l0).normalized;
            var dotp = Vector2.Dot( toPt, rightDir );
            
            if( Mathf.Abs(dotp) < 1e-4)
            {
                ptIsOnRight[i] = false;
                // nudge it into the left half-space a little bit to avoid creating self-intersecting polygons
                pts[i] -= rightDir*1e-4;
            }
            else
                ptIsOnRight[i] = (dotp > 0 );
		}
		
		// keep right points and add their reflections
		var newPts = new Array();
		var old2ref = new int[ npts ];
		var old2new = new int[ npts ];
		for( i = 0; i < npts; i++ )
		{
			if( ptIsOnRight[i] )
			{
				newPts.Push( pts[i] );
				old2new[i] = newPts.length-1;

				// add reflection
				newPts.Push( Math2D.Reflect2D( pts[i], l0, l1 ) );
				old2ref[i] = newPts.length-1;
			}
		}

		// go through edges
		var newA = new Array();
		var newB = new Array();

		for( i = 0; i < edgeA.length; i++ )
		{
			var a = edgeA[i];
			var b = edgeB[i];

			if( ptIsOnRight[a] && ptIsOnRight[b] )
			{
				// yay add both this one and its reflection
				newA.Push( old2new[a] );
				newB.Push( old2new[b] );

                if( mirrorOrientation ) {
				    newB.Push( old2ref[b] );
				    newA.Push( old2ref[a] );
                }
                else {
				    // note the opposite direction
				    newA.Push( old2ref[b] );
				    newB.Push( old2ref[a] );
                }
			}
			else if( ptIsOnRight[a] && !ptIsOnRight[b] )
			{
				// add the intersection point
				var intx = Math2D.Intersect2DLines( l0, l1, pts[a], pts[b] );
				newPts.Push( intx );
				var c = newPts.length-1;

				// register new edges
				newA.Push( old2new[a] );
				newB.Push( c );

				// now its reflection with opposite direction
                if( mirrorOrientation ) {
				    newB.Push( c );
				    newA.Push( old2ref[a] );
                }
                else {
				    newA.Push( c );
				    newB.Push( old2ref[a] );
                }
			}
			else if( !ptIsOnRight[a] && ptIsOnRight[b] )
			{
				// add the intersection point
				intx = Math2D.Intersect2DLines( l0, l1, pts[a], pts[b] );
				newPts.Push( intx );
				c = newPts.length-1;

				// left to center
                if( mirrorOrientation ) {
                    newB.Push( old2ref[b] );
                    newA.Push( c );
                }
                else {
                    newA.Push( old2ref[b] );
                    newB.Push( c );
                }

                // center to original
                newA.Push( c );
                newB.Push( old2new[b] );
			}
			else
			{
				// edge is completely on left side - ignore
			}
		}

		pts = newPts.ToBuiltin(Vector2);
		edgeA = newA.ToBuiltin(int);
		edgeB = newB.ToBuiltin(int);		
	}

	function Reflect( l0:Vector2, l1:Vector2, keepRight:boolean )
    {
        Reflect( l0, l1, keepRight, false );
    }

	function Append( other:Mesh2D )
	{
		if( pts == null ) pts = new Vector2[0];
		if( edgeA == null ) edgeA = new int[0];
		if( edgeB == null ) edgeB = new int[0];
		var oldNumPts = pts.length;
		var oldNumEdges = edgeA.length;

		pts = Utils.Concatenate( pts, other.pts );
		edgeA = Utils.Concatenate( edgeA, other.edgeA );
		edgeB = Utils.Concatenate( edgeB, other.edgeB );

		// need to increment other edge indices
		for( var i = 0; i < other.edgeA.length; i++ )
		{
			edgeA[ oldNumEdges + i ] += oldNumPts;
			edgeB[ oldNumEdges + i ] += oldNumPts;
		}
	}

	//----------------------------------------
	//  This just does a per-point test, which is necessary and sufficient for
	//	complete containment
	//----------------------------------------
	function ContainedBy( r:Rect ) : boolean
	{
		for( var i = 0; i < pts.length; i++ ) {
			if( !r.Contains( pts[i] ) )
				return false;
		}

		return true;
	}

	//----------------------------------------
	//  Assumes that the current mesh is "manifold", ie. each vertex has exactly 2 incident edges
	//----------------------------------------
	function GetEdgeLoop( startEid:int ) : List.<int>
	{
		var loop = new List.<int>();
		loop.Add( startEid );
		var prevEid = startEid;

		while( true ) {
			// check if we're complete yet
			if( edgeA[startEid] == edgeB[prevEid] )
				// done - found the whole loop
				break;

			for( var nextEid = 0; nextEid < edgeA.length; nextEid++ ) {
				if( edgeA[nextEid] == edgeB[prevEid] ) {
					// got next one
					loop.Add(nextEid);
					prevEid = nextEid;
					break;
				}
			}
		}
		
		return loop;
	}
}

//----------------------------------------
//  For efficient vertex-neighbor queries
//----------------------------------------
class PolyVertexNbors
{
	private var data:int[];

	function GetPrev( vid:int ):int { return data[ 2*vid + 0 ]; }
	function GetNext( vid:int ):int { return data[ 2*vid + 1 ]; }

	function SetPrev( vid:int, nbor:int ) { data[ 2*vid + 0 ] = nbor; }
	function SetNext( vid:int, nbor:int ) { data[ 2*vid + 1 ] = nbor; }

	function AreNeighbors( a:int, b:int ) {
		return GetPrev( a ) == b || GetPrev( b ) == a;
	}

	function IsUsed( vid:int ) { return data[2*vid+0] != -1; }

	function Reset( poly:Mesh2D, isClockwise:boolean )
	{
		data = new int[ 2*poly.GetNumVertices() ];
		for( var i = 0; i < data.length; i++ )
			data[i] = -1;

		for( var eid = 0; eid < poly.GetNumEdges(); eid++ )
		{
			var a = poly.edgeA[ eid ];
			var b = poly.edgeB[ eid ];

			if( isClockwise ) {
				a = poly.edgeB[ eid ];
				b = poly.edgeA[ eid ];
			}

			SetPrev( b, a );
			SetNext( a, b );
		}
	}

	// a variant for a sub-polygon
	function Reset( numVerts:int, edge2verts:List.<int>, activeEdges:List.<int> )
	{
		data = new int[ 2*numVerts ];
		for( var i = 0; i < 2*numVerts; i++ )
			data[i] = -1;

		for( var edgeNum = 0; edgeNum < activeEdges.Count; edgeNum++ ) {
			var eid = activeEdges[edgeNum];
			var a = edge2verts[ 2*eid+0 ];
			var b = edge2verts[ 2*eid+1 ];
			SetPrev( b, a );
			SetNext( a, b );
		}
	}

}

class Vector2IdPair {
	var v : Vector2;
	var id : int;

	static function CompareByX( a:Vector2IdPair, b:Vector2IdPair ) : int {
		return ProGeo.CompareByXThenY( a.v, b.v );
	}
}

class TriIndices {
	var verts = new int[3];
}

//----------------------------------------
//  Helper class for simple poly triangulation
//----------------------------------------
class MonotoneDecomposition
{
	enum VertType { REGULAR_TOP, REGULAR_BOTTOM, START, END, MERGE, SPLIT };

	//----------------------------------------
	//  Pointers to helper info
	//----------------------------------------
	private var poly:Mesh2D;
	private var edge2verts:List.<int>;
	private var sortedVerts:List.<Vector2IdPair>;
	private var nbors:PolyVertexNbors;

	//----------------------------------------
	//  Internal state
	//----------------------------------------

	class HelperInfo {
		var vid:int;
		var type:VertType;
        var topPieceId:int;
        var botPieceId:int;

        function IsMerge() : boolean { return type == VertType.MERGE; }
	}
	private var edgeHelper:List.<HelperInfo> = null;
    private var edgePieceId:List.<int> = null;
    private var numPieces:int = 0;

	private var vert2prevEdge = new List.<int>();
	private var vert2nextEdge = new List.<int>();
	private var vert2type = new List.<String>();
	private var currSid:int;

    function GetVertexType(vid:int) : String { return vert2type[vid]; }

    function GetNumPieces() { return numPieces; }

    function GetEdgePieceId(eid:int)
    {
    	Utils.Assert(eid < edgePieceId.Count );
    	return edgePieceId[eid];
	}

	//----------------------------------------
	//  Performs the plane sweep algorithm and adds edges for a
	//	monotone-polygon decompostion of the given polygon
	//----------------------------------------
	function Reset(
			_poly:Mesh2D,
			_edge2verts:List.<int>,	// this will be modified with new edges
			_sortedVerts:List.<Vector2IdPair>,
			_nbors:PolyVertexNbors )
	{
		poly = _poly;
		edge2verts = _edge2verts;
		sortedVerts = _sortedVerts;
		nbors = _nbors;
		currSid = 0;
		
		//----------------------------------------
		//  Build vert2edge tables
		//----------------------------------------
		
		var NE = edge2verts.Count/2;
		var NV = poly.pts.length;
		vert2prevEdge = new List.<int>(NV);
		vert2nextEdge = new List.<int>(NV);
        vert2type = new List.<String>(NV);
		
		for( var i = 0; i < NV; i++ ) {
			vert2prevEdge.Add(-1);
			vert2nextEdge.Add(-1);
            vert2type.Add("-");
		}

		for( var eid = 0; eid < NE; eid++ ) {
			vert2nextEdge[ edge2verts[ 2*eid + 0 ] ] = eid;
			vert2prevEdge[ edge2verts[ 2*eid + 1 ] ] = eid;
		}

		// check
		for( i = 0; i < NV; i++ ) {
			Utils.Assert( vert2nextEdge[i] != -1, 'vert '+i+' does not have a next!');
			Utils.Assert( vert2prevEdge[i] != -1, 'vert '+i+' does not have a prev!');
		}

		//----------------------------------------
		//  Init swept edges table
		//----------------------------------------
		
		edgeHelper = new List.<HelperInfo>(NE);
        edgePieceId = new List.<int>(NE);
		
		for( eid = 0; eid < NE; eid++ ) {
			edgeHelper.Add(null);
            edgePieceId.Add(-1);
		}

        numPieces = 0;
	}

	function GetEdgeStart( eid:int ) { return poly.pts[ edge2verts[2*eid+0] ]; }
    
	function GetEdgeEnd( eid:int ) { return poly.pts[ edge2verts[2*eid+1] ]; }

    //----------------------------------------
    //   TODO - this could be optimized...somehow?
    //----------------------------------------
	function FindEdgeAbove( p:Vector2 ) : int
	{
		var bestEid = -1;
		var bestDist = 0.0;

		for( var eid = 0; eid < edgeHelper.Count; eid++ ) {
			if( edgeHelper[eid] != null ) {
				// edge is still in sweep
				var y = Math2D.EvalLineAtX( GetEdgeStart(eid), GetEdgeEnd(eid), p.x );
				if( y > p.y ) {
					var dist = y-p.y;
					if( bestEid == -1 || dist < bestDist ) {
						bestEid = eid;
						bestDist = dist;
					}
				}
			}
		}

		return bestEid;
	}

	//----------------------------------------
	//  
	//----------------------------------------
	function DebugDrawActiveEdges( c:Color, diagColor:Color )
	{
		// draw active edges
		for( var eid = 0; eid < edgeHelper.Count; eid++ ) {
			if( edgeHelper[eid] != null ) {
				Debug.DrawLine( GetEdgeStart(eid), GetEdgeEnd(eid), c );
			}
		}

		// draw added diagonals
		for( eid = edgeHelper.Count; eid < edge2verts.Count/2; eid++ ) {
				Debug.DrawLine( GetEdgeStart(eid), GetEdgeEnd(eid), diagColor );
		}
	}

	//----------------------------------------
	//  Stuff for polygon triangulation
	//----------------------------------------

	function EvalVertType( vid:int ) : VertType
	{
		var pos = poly.pts[ vid ];
		var prevPos = poly.pts[ nbors.GetPrev( vid ) ];
		var nextPos = poly.pts[ nbors.GetNext( vid ) ];
		var prevCmp = ProGeo.CompareByXThenY( prevPos, pos );
		var nextCmp = ProGeo.CompareByXThenY( nextPos, pos );

		if( prevCmp == nextCmp ) {
			// both on same "side", cannot be colinear
			if( prevCmp < 0 ) {
				// both on left
				// assume CCW
				if( Math2D.IsLeftOfLine( nextPos, prevPos, pos ) ) {
					return VertType.END;
				} else {
					return VertType.MERGE;
				}
			} else {
				// both on right
				if( Math2D.IsLeftOfLine( nextPos, prevPos, pos ) ) {
					return VertType.START;
				} else {
					return VertType.SPLIT;
				}
			}
		} else {
			if( prevCmp < 0 )
				return VertType.REGULAR_BOTTOM;
			else
				return VertType.REGULAR_TOP;
		}
	}

    // Returns the piece ID of the BOTTOM piece if diagonals were added. Otherwise, -1
	private function AddDiagonalIfMergeHelper( eid:int, otherVid:int, returnBot:boolean ) : int
	{
		if( !Utils.Assert( eid < edgeHelper.Count, "edgeId = " +eid+ " edgeHelper.Count = "+edgeHelper.Count ) )
			return -1;
		if( !Utils.Assert( eid >= 0, "edgeId = "+eid ) )
			return -1;
		if( edgeHelper[ eid ] != null && edgeHelper[ eid ].IsMerge() ) 
        {
            var helper = GetHelper(eid);
            Utils.Assert( helper.topPieceId != -1 );
            Utils.Assert( helper.botPieceId != -1 );
			AddDoubledDiagonal( helper.vid, otherVid, helper.topPieceId, helper.botPieceId );

            if( returnBot )
                return helper.botPieceId;
            else
                return helper.topPieceId;
        }
        else
            return -1;
	}

    private function AddDiagonalIfMergeHelper( eid:int, otherVid:int )
    {
        AddDiagonalIfMergeHelper( eid, otherVid, false );
    }

	private function SetHelper( eid:int, vid:int, type:VertType, topPid:int, botPid:int )
	{
		var info = edgeHelper[eid];

        if( info == null )
        {
            info = new HelperInfo();
            edgeHelper[eid] = info;
        }

        info.vid = vid;
        info.type = type;
        info.topPieceId = topPid;
        info.botPieceId = botPid;
	}

    private function GetHelper(eid:int)
    {
        return edgeHelper[eid];
    }

	private function DeactivateEdge( eid:int ) 
	{
		edgeHelper[ eid ] = null;
	}

    // The top/bot terminology assumes v1->v2 is left->right
	private function AddDoubledDiagonal( v1:int, v2:int, topPieceId:int, botPieceId:int ) 
	{
		edge2verts.Add( v1 );
		edge2verts.Add( v2 );
		edge2verts.Add( v2 );
		edge2verts.Add( v1 );

        edgePieceId.Add( topPieceId );
        edgePieceId.Add( botPieceId );
	}

	//----------------------------------------
	//  Performs one step of the plane sweep algo.
	//	Returns true if more steps are needed
	//----------------------------------------
	function Step( verbose:boolean ) : boolean
	{
		// safety
		if( currSid >= sortedVerts.Count )
			return false;

		var NV = poly.pts.length;
		var currVid = sortedVerts[ currSid ].id;
		var currType = EvalVertType( currVid );
		var e1 = vert2prevEdge[currVid];
		var e2 = vert2nextEdge[currVid];
		var aboveEdge = -1;
        var botPieceId = -1;
        var topPieceId = -1;
        var pieceId = -1;

		if( currType == VertType.START )
        {
            vert2type[currVid] = "S";
            Utils.Assert( edgePieceId[e1] == -1 );
            Utils.Assert( edgePieceId[e2] == -1 );

            pieceId = numPieces++;
            SetHelper( e1, currVid, currType, pieceId, pieceId );
            edgePieceId[e1] = pieceId;
            edgePieceId[e2] = pieceId;
		}
		else if( currType == VertType.END )
        {
            vert2type[currVid] = "E";
            Utils.Assert( edgePieceId[e1] != -1 );
            Utils.Assert( edgePieceId[e2] != -1 );

            if( GetHelper(e1) != null && GetHelper(e1).IsMerge() )
            {
                Utils.Assert( edgePieceId[e1] == GetHelper(e1).botPieceId );
                Utils.Assert( edgePieceId[e2] == GetHelper(e1).topPieceId );
            }

            // I don't think e1 should ever be active, since it's a "bottom" edge
            Utils.Assert( GetHelper(e1) == null );
			//AddDiagonalIfMergeHelper( e1, currVid );
			//DeactivateEdge( e1 );

			AddDiagonalIfMergeHelper( e2, currVid );
			DeactivateEdge( e2 );
		}
		else if( currType == VertType.SPLIT ) {
            vert2type[currVid] = "P";
            Utils.Assert( edgePieceId[e1] == -1 );
            Utils.Assert( edgePieceId[e2] == -1 );

			aboveEdge = FindEdgeAbove( poly.pts[currVid] );
			Utils.Assert( aboveEdge != -1 );

            var helper = GetHelper(aboveEdge);
            Utils.Assert( helper.topPieceId != -1 );
            Utils.Assert( helper.botPieceId != -1 );
            Utils.Assert( helper.type != VertType.END );

            if( helper.type == VertType.MERGE )
            {
                Utils.Assert( helper.topPieceId != helper.botPieceId );
                AddDoubledDiagonal( helper.vid, currVid, helper.topPieceId, helper.botPieceId );
                edgePieceId[e1] = helper.botPieceId;
                edgePieceId[e2] = helper.topPieceId;
                SetHelper( aboveEdge, currVid, currType, helper.topPieceId, helper.topPieceId );
                SetHelper( e1, currVid, currType, edgePieceId[e1], edgePieceId[e1] );
            }
            else if( vert2prevEdge[helper.vid] == aboveEdge )
            {
                Utils.Assert( helper.type == VertType.REGULAR_TOP || helper.type == VertType.START || helper.type == VertType.SPLIT );
                pieceId = numPieces++;
                AddDoubledDiagonal( helper.vid, currVid, pieceId, helper.botPieceId );
                edgePieceId[ aboveEdge ] = pieceId;
                edgePieceId[e1] = helper.botPieceId;
                edgePieceId[e2] = pieceId;
                SetHelper( aboveEdge, currVid, currType, pieceId, pieceId );
                SetHelper( e1, currVid, currType, edgePieceId[e1], edgePieceId[e1] );
            }
            else
            {
                Utils.Assert( helper.type == VertType.REGULAR_BOTTOM || helper.type == VertType.SPLIT );
                pieceId = numPieces++;
                AddDoubledDiagonal( helper.vid, currVid, helper.topPieceId, pieceId );
                edgePieceId[ vert2nextEdge[helper.vid] ] = pieceId;
                edgePieceId[e1] = pieceId;
                edgePieceId[e2] = helper.topPieceId;
                SetHelper( aboveEdge, currVid, currType, helper.topPieceId, helper.topPieceId );
                SetHelper( e1, currVid, currType, edgePieceId[e1], edgePieceId[e1] );
            }
		}
		else if( currType == VertType.MERGE ) {
            vert2type[currVid] = "M";
            Utils.Assert( edgePieceId[e1] != -1 );
            Utils.Assert( edgePieceId[e2] != -1 );
            Utils.Assert( edgePieceId[e1] != edgePieceId[e2] );

            // e1 is a bottom edge, so never should be active
            Utils.Assert( GetHelper(e1) == null );
			//AddDiagonalIfMergeHelper( e1, currVid );
			//DeactivateEdge( e1 );

            // Handle bottom side
			botPieceId = AddDiagonalIfMergeHelper( e2, currVid, true );
			DeactivateEdge( e2 );
            if( botPieceId == -1 )
                botPieceId = edgePieceId[e2];
			
            // Handle top side
			aboveEdge = FindEdgeAbove( poly.pts[currVid] );
			topPieceId = AddDiagonalIfMergeHelper( aboveEdge, currVid, false );
            if( topPieceId == -1 )
                topPieceId = edgePieceId[e1];

            SetHelper( aboveEdge, currVid, currType, topPieceId, botPieceId );
		}
		else if( currType == VertType.REGULAR_TOP ) {
            vert2type[currVid] = "T";
            Utils.Assert( edgePieceId[e1] == -1 );
            Utils.Assert( edgePieceId[e2] != -1 );

			botPieceId = AddDiagonalIfMergeHelper( e2, currVid, true );
			DeactivateEdge( e2 );
            if( botPieceId == -1 )
                botPieceId = edgePieceId[e2];

            edgePieceId[e1] = botPieceId;
			SetHelper(e1, currVid, currType, botPieceId, botPieceId);
		}
		else if( currType == VertType.REGULAR_BOTTOM ) {
            vert2type[currVid] = "B";
            Utils.Assert( edgePieceId[e1] != -1 );
            Utils.Assert( edgePieceId[e2] == -1 );

            Utils.Assert( GetHelper(e1) == null );
            Utils.Assert( GetHelper(e2) == null );

			//topPieceId = AddDiagonalIfMergeHelper( e1, currVid, false );
			//DeactivateEdge( e1 );

            //if( topPieceId == -1 )
                //edgePieceId[e2] = edgePieceId[e1];
            //else
            //{
                //Utils.Assert(false, "I don't ever expect this to happen, since merge-helpers are only ever added to 'above' edges");
                // If this actually does happen, then I need to handle the fixing of prev/next edges for this helper
                //edgePieceId[e2] = topPieceId;
            //}

			// Steve: This is my "bug fix" that both algo descriptions seem to ignore, but it's necessary to keep the helper invariant
			aboveEdge = FindEdgeAbove( poly.pts[currVid] );
			topPieceId = AddDiagonalIfMergeHelper( aboveEdge, currVid, false );
            if( topPieceId == -1 )
                topPieceId = edgePieceId[e1];

            edgePieceId[e2] = topPieceId;
            SetHelper( aboveEdge, currVid, currType, topPieceId, topPieceId );
		}

        vert2type[currVid] += "-"+currSid;

		// step
		currSid++;
		var moreSteps = currSid < sortedVerts.Count;

		return moreSteps;
	}
	
	function Step() : boolean { return Step(false); }

    function DebugDrawState()
    {
        var piecesDebugColor:Color[] = [ Color.red, Color.green, Color.blue, Color.white, Color.black, Color.yellow, Color.cyan, Color.magenta ];

        for( var pieceId = 0; pieceId < GetNumPieces(); pieceId++ )
        {
            for( var eid = 0; eid < edge2verts.Count/2; eid++ ) {
                if( GetEdgePieceId(eid) != pieceId )
                    continue;

                var clr = piecesDebugColor[pieceId % piecesDebugColor.length];

                var svid = edge2verts[ 2*eid + 0 ];
                var evid = edge2verts[ 2*eid + 1 ];
                var a = poly.pts[svid];
                var b = poly.pts[evid];

                /*				
                                var c = (a+b)/2.0;
                                var margin = 0.1;
                                a = a + (c-a).normalized*margin;
                                b = b + (c-b).normalized*margin;
                                var right = Math2D.PerpCCW((b-a).normalized);
                                a += right*margin;
                                b += right*margin;
                 */			
                var labelPt = (a+b)/2.0 + Math2D.PerpCCW((b-a).normalized)*0.2;
                Debug.DrawLine( a, b, clr, 0 );
                Debug.DrawLine( labelPt, a, clr, 0 );
                Debug.DrawLine( labelPt, b, clr, 0 );
                //DebugText.Add( labelPt, ""+eid+"/"+GetEdgePieceId(eid) );
                //DebugText.Add( labelPt, ""+pieceId );

                //DebugText.Add( a, GetVertexType(svid) );
                //DebugText.Add( b, GetVertexType(evid) );
            }
        }
    }
}

static var s_debugSweepStep = 0;

//----------------------------------------
//  
//----------------------------------------
static function TriangulateSimplePolygon( poly:Mesh2D, mesh:Mesh, isClockwise:boolean )
{
	var verbose = Input.GetButtonDown("DebugNext");

	var NV = poly.GetNumVertices();
    var eid:int = -1;

	// create nbor query datastructure
	var nbors = new PolyVertexNbors();
	nbors.Reset( poly, isClockwise );

	// edge2verts is the list of edges that will be manipulated in order to form the triangulated mesh
	// every 2-block is an oriented edge of vertex IDs
	var edge2verts = new List.<int>();

	// create oriented edges of original polygon
	for( var vid = 0; vid < NV; vid++ ) {
		edge2verts.Add( vid );
		edge2verts.Add( nbors.GetNext( vid ) );
	}

	//----------------------------------------
	//  Sort vertices by X,Y
	//----------------------------------------

	// First we need to sort the verts by X for determining diagonal ends
	var sortedVerts = new List.<Vector2IdPair>();

	// Store them in this datastructure so we can do this sorting
	for( var i = 0; i < poly.GetNumVertices(); i++ ) {
		var pair = new Vector2IdPair();
		pair.v = poly.pts[i];
		pair.id = i;
		sortedVerts.Add( pair );
	}

	sortedVerts.Sort( Vector2IdPair.CompareByX );
	
	if( verbose ) {
		var str = "";
		for( i = 0; i < sortedVerts.Count; i++ )
		{
			str += sortedVerts[i].v + " ";
		}
		Debug.Log(str);
	}

    if( Input.GetButtonDown("DebugPrev") )
        s_debugSweepStep--;
    else if( Input.GetButtonDown("DebugNext") )
        s_debugSweepStep++;

	//----------------------------------------
	//  Let the plane sweep algorithm do its thing
	//----------------------------------------
    var step = 0;
	var md = new MonotoneDecomposition();
	md.Reset( poly, edge2verts, sortedVerts, nbors );	
	while( md.Step() )
    {
        if( step == s_debugSweepStep )
        {
            md.DebugDrawState();
            if( Input.GetButtonDown("DebugReset") )
            {
                Debug.Log("debug me");
            }
        }
        step++;
    }

    if( s_debugSweepStep == -1 )
    {
        md.DebugDrawState();
    }

	//----------------------------------------
	//  Traverse the graph to extract and triangulate monotone pieces
	//----------------------------------------

	// we'll store the tri specs in this list
	var tris = new List.<TriIndices>();

	var NE = edge2verts.Count/2;
	var edgeVisited = new boolean[ NE ];
	for( eid = 0; eid < NV; eid++ )
		edgeVisited[ eid ] = false;

	var firstEid = 0;
	
	while( firstEid < NV ) {
		// move to the next unvisited edge
		while( firstEid < NV && edgeVisited[ firstEid ] )
			firstEid++;

		if( firstEid >= NV )
			// all done
			break;

		// find a new monotone piece
		var pieceEdges = new List.<int>();
		pieceEdges.Add( firstEid );

		var currEid = firstEid;
		var pieceFound = false;

		// follow the edge loop from firstEid until we hit the firstEid again
        // TODO this could be faster - we just need to iterate through the piece numbers, don't need to maintain visited flags
		while( true ) {
            if( currEid == -1 )
                break;

			edgeVisited[currEid] = true;
			var currEnd = edge2verts[ 2*currEid+1 ];

			// find the outgoing edge from the current edge's end with the LARGEST angle
			var nextEid = -1;
			var backToFirst = false;
            // TODO this could be faster by building vert->usingedges sets
			for( var otherEid = 0; otherEid < NE; otherEid++ )
            {
				var otherStart = edge2verts[ 2*otherEid ];

                if( md.GetEdgePieceId(otherEid) != md.GetEdgePieceId(currEid) )
                    continue;

				if( otherStart != currEnd )
					continue;

				// back to first? make sure we do this before the visited check,
				// since obviously the first edge was visited
				if( otherEid == firstEid ) {
					backToFirst = true;
					break;
				}

				if( edgeVisited[ otherEid ] )
					continue;

                // found it
                nextEid = otherEid;
                break;
			}

			if( backToFirst )
				// done!
				break;

			if( !Utils.Assert( nextEid != -1, "Could not find a closed edge-loop for starting edge currEid="+currEid+". Are you sure the polygon is non-self-intersecting?" ) )
                return;

			pieceEdges.Add( nextEid );
			currEid = nextEid;
		}


		//----------------------------------------
		//  Triangulate this piece
		//----------------------------------------
		TriangulateMonotonePolygon( sortedVerts, edge2verts, pieceEdges, tris );
	}

	//----------------------------------------
	//  Finally, transfer to the mesh
	//	TODO - store these so we're not allocating everytime..
	//----------------------------------------
	var meshVerts = new Vector3[ poly.GetNumVertices() ];
	var triangles = new int[ 3*tris.Count ];

	for( i = 0; i < poly.GetNumVertices(); i++ ) {
		meshVerts[i] = poly.pts[i];
	}
	for( i = 0; i < tris.Count; i++ ) {
		// remember, our tri verts are CCW, but unity expects them in CW
		// thus, the 2/1 flip
		triangles[ 3*i + 0 ] = tris[i].verts[0];
		triangles[ 3*i + 1 ] = tris[i].verts[2];
		triangles[ 3*i + 2 ] = tris[i].verts[1];
	}

	// as of Unity 3.5.4, it actually checks for integrity, so we need to clear the mesh's tris before setting other stuff
	mesh.triangles = null;
	mesh.vertices = meshVerts;
	mesh.triangles = triangles;
	
	var uv = new Vector2[ poly.GetNumVertices() ];
	for( i = 0; i < uv.length; i++ ) uv[i] = meshVerts[i];
	mesh.uv = uv;

	// Mesh bounds are used for visiblity culling
	mesh.RecalculateBounds();
	
	//Debug.Log('triangulated polygon to '+tris.Count+' triangles');
}

//----------------------------------------
//	O( n log n) polygon triangulation algorithm
//  Reference: http://www.cs.ucsb.edu/~suri/cs235/Triangulation.pdf
//----------------------------------------
static function TriangulateMonotonePolygon(
		sortedVerts:List.<Vector2IdPair>,
		edge2verts:List.<int>,
		pieceEdges:List.<int>,	// the edges that are part of the monotone piece
		tris:List.<TriIndices> )
{
	var i = 0;
	// create nbor query datastructure
	var nbors = new PolyVertexNbors();
	nbors.Reset( sortedVerts.Count, edge2verts, pieceEdges );

	var sidStack = new Stack.<int>();

	// push first two used vertices onto the stack
	for( var aSid = 0; sidStack.Count < 2; aSid++ ) {
		if( nbors.IsUsed( sortedVerts[aSid].id ) ) {
			sidStack.Push( aSid );
		}
	}

	// start right after the one last pushed
	for( aSid = aSid; aSid < sortedVerts.Count; aSid++ )
	{
		var aVid = sortedVerts[ aSid ].id;
		var aPt = sortedVerts[ aSid ].v;

		// skips verts that aren't in the sub-piece
		if( !nbors.IsUsed( aVid ) )
			continue;

		var topSid = sidStack.Peek();
		var topVid = sortedVerts[ topSid ].id;

		if( nbors.AreNeighbors( aVid, topVid ) )
		{
			var botCase = (nbors.GetPrev( aVid ) == topVid);

			while( sidStack.Count > 0 ) {
				var bSid = sidStack.Pop();
				var bVid = sortedVerts[ bSid ].id;
				if( sidStack.Count == 0 ) {
					// 
					sidStack.Push( bSid );
					sidStack.Push( aSid );
					break;
				}
				var cSid = sidStack.Pop();
				var cVid = sortedVerts[ cSid ].id;

				// see if this makes a valid inside-polygon triangle
				var bPt = sortedVerts[ bSid ].v;
				var cPt = sortedVerts[ cSid ].v;

				var tri:TriIndices = null;
				if( botCase ) {
					if( Math2D.IsRightOfLine( bPt, cPt, aPt ) ) {
						tri = new TriIndices();
						tri.verts[0] = aVid;
						tri.verts[1] = cVid;
						tri.verts[2] = bVid;
					}
				}
				else {
					if( Math2D.IsLeftOfLine( bPt, cPt, aPt ) ) {
						tri = new TriIndices();
						tri.verts[0] = aVid;
						tri.verts[1] = bVid;
						tri.verts[2] = cVid;
					}
				}

				if( tri != null ) {
					tris.Add( tri );
					sidStack.Push( cSid );
				}
				else {
					// couldn't make a tri, push these guys back on, and we're done
					sidStack.Push( cSid );
					sidStack.Push( bSid );
					sidStack.Push( aSid );
					break;
				}
			}
		}
		else {
			// not neighbors
			while( sidStack.Count > 0 ) {
				bSid = sidStack.Pop();
				// was this our last one?
				if( sidStack.Count == 0 ) break;
				bVid = sortedVerts[ bSid ].id;
				cSid = sidStack.Pop();
				cVid = sortedVerts[ cSid ].id;

				// see if this makes a valid inside-polygon triangle
				bPt = sortedVerts[ bSid ].v;
				cPt = sortedVerts[ cSid ].v;

				tri = new TriIndices();

				if( Math2D.IsRightOfLine( bPt, cPt, aPt ) ) {
					tri.verts[0] = aVid;
					tri.verts[1] = cVid;
					tri.verts[2] = bVid;
					tris.Add(tri);
				}
				else if( Math2D.IsLeftOfLine( bPt, cPt, aPt ) ) {
					tri.verts[0] = aVid;
					tri.verts[1] = bVid;
					tri.verts[2] = cVid;
					tris.Add(tri);
				}
				// don't add degen tris
				
				// put C back on for the next iter
				sidStack.Push( cSid );
			}

			// done
			sidStack.Push( topSid );
			sidStack.Push( aSid );
		}
	}

}

static function BuildBeltMesh( poly:Mesh2D, zMin:float, zMax:float, normalPointingRight:boolean, mesh:Mesh )
{
	BuildBeltMesh( poly.pts, poly.edgeA, poly.edgeB, zMin, zMax, normalPointingRight, mesh );
}

static function BuildBeltMesh(
		pts:Vector2[],
		edgeA:int[], edgeB:int[],
		zMin:float, zMax:float,
		normalPointingRight:boolean,
		mesh:Mesh )
{
	if( pts == null ) {
		mesh.Clear();
		return;
	}

	var npts = pts.length;

	var vertices = new Vector3[ 2*npts ];
	for( var i = 0; i < npts; i++ )
	{
		var p = pts[i];
		vertices[2*i+0] = Vector3( p.x, p.y, zMin );
		vertices[2*i+1] = Vector3( p.x, p.y, zMax );
	}

	var ntris = 2 * edgeA.length;
	var triangles = new int[ ntris * 3 ];

	for( i = 0; i < edgeA.length; i++ )
	{
		var a = edgeA[i];
		var b = edgeB[i];

		if( normalPointingRight )
		{
			triangles[ 6*i + 0 ] = 2 * a + 0;
			triangles[ 6*i + 1 ] = 2 * b + 0;
			triangles[ 6*i + 2 ] = 2 * a + 1;

			triangles[ 6*i + 3 ] = 2 * b + 0;
			triangles[ 6*i + 4 ] = 2 * b + 1;
			triangles[ 6*i + 5 ] = 2 * a + 1;
		}
		else
		{
			triangles[ 6*i + 0 ] = 2 * a + 0;
			triangles[ 6*i + 1 ] = 2 * a + 1;
			triangles[ 6*i + 2 ] = 2 * b + 0;

			triangles[ 6*i + 3 ] = 2 * b + 0;
			triangles[ 6*i + 4 ] = 2 * a + 1;
			triangles[ 6*i + 5 ] = 2 * b + 1;
		}
	}

	// finalize
	// as of Unity 3.5.4, it actually checks for integrity, so we need to clear the mesh's tris before setting other stuff
	mesh.triangles = null;
	mesh.vertices = vertices;
	mesh.RecalculateNormals();
	mesh.uv = new Vector2[ 2*npts ];
	mesh.triangles = triangles;
}
