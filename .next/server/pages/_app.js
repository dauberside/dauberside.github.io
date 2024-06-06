/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "./components/Footer.js":
/*!******************************!*\
  !*** ./components/Footer.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _Player__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Player */ \"./components/Player.js\");\n\n\nconst Footer = ({ spotifyToken })=>{\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"footer\", {\n        id: \"footer\",\n        children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_Player__WEBPACK_IMPORTED_MODULE_1__[\"default\"], {\n            token: spotifyToken\n        }, void 0, false, {\n            fileName: \"/Volumes/Extreme Pro/dauberside.github.io/components/Footer.js\",\n            lineNumber: 6,\n            columnNumber: 7\n        }, undefined)\n    }, void 0, false, {\n        fileName: \"/Volumes/Extreme Pro/dauberside.github.io/components/Footer.js\",\n        lineNumber: 5,\n        columnNumber: 5\n    }, undefined);\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Footer);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9jb21wb25lbnRzL0Zvb3Rlci5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUE4QjtBQUU5QixNQUFNQyxTQUFTLENBQUMsRUFBRUMsWUFBWSxFQUFFO0lBQzlCLHFCQUNFLDhEQUFDQztRQUFPQyxJQUFHO2tCQUNULDRFQUFDSiwrQ0FBTUE7WUFBQ0ssT0FBT0g7Ozs7Ozs7Ozs7O0FBR3JCO0FBRUEsaUVBQWVELE1BQU1BLEVBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9kYXViZXJzaWRlLmdpdGh1Yi5pby8uL2NvbXBvbmVudHMvRm9vdGVyLmpzP2UxYWIiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFBsYXllciBmcm9tICcuL1BsYXllcic7XG5cbmNvbnN0IEZvb3RlciA9ICh7IHNwb3RpZnlUb2tlbiB9KSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGZvb3RlciBpZD1cImZvb3RlclwiPlxuICAgICAgPFBsYXllciB0b2tlbj17c3BvdGlmeVRva2VufSAvPlxuICAgIDwvZm9vdGVyPlxuICApO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgRm9vdGVyOyJdLCJuYW1lcyI6WyJQbGF5ZXIiLCJGb290ZXIiLCJzcG90aWZ5VG9rZW4iLCJmb290ZXIiLCJpZCIsInRva2VuIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./components/Footer.js\n");

/***/ }),

/***/ "./components/Player.js":
/*!******************************!*\
  !*** ./components/Player.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ \"react\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);\n\n\nconst Player = ({ token })=>{\n    const [player, setPlayer] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);\n    const [isPaused, setPaused] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);\n    const [trackName, setTrackName] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(\"\");\n    const [artistName, setArtistName] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(\"\");\n    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(()=>{\n        const script = document.createElement(\"script\");\n        script.src = \"https://sdk.scdn.co/spotify-player.js\";\n        script.async = true;\n        document.body.appendChild(script);\n        window.onSpotifyWebPlaybackSDKReady = ()=>{\n            const player = new window.Spotify.Player({\n                name: \"Web Playback SDK Player\",\n                getOAuthToken: (cb)=>{\n                    cb(token);\n                },\n                volume: 0.5\n            });\n            player.addListener(\"ready\", ({ device_id })=>{\n                console.log(\"Ready with Device ID\", device_id);\n            });\n            player.addListener(\"player_state_changed\", (state)=>{\n                if (!state) {\n                    return;\n                }\n                setTrackName(state.track_window.current_track.name);\n                setArtistName(state.track_window.current_track.artists.map((artist)=>artist.name).join(\", \"));\n                setPaused(state.paused);\n                player.getCurrentState().then((state)=>{\n                    if (!state) {\n                        console.error(\"User is not playing music through the Web Playback SDK\");\n                        return;\n                    }\n                });\n            });\n            player.connect();\n            setPlayer(player);\n        };\n    }, []);\n    const handlePlayPause = ()=>{\n        if (player) {\n            if (isPaused) {\n                player.resume().then(()=>{\n                    setPaused(false);\n                });\n            } else {\n                player.pause().then(()=>{\n                    setPaused(true);\n                });\n            }\n        }\n    };\n    const handleNextTrack = ()=>{\n        if (player) {\n            player.nextTrack();\n        }\n    };\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n        id: \"spotify-player\",\n        children: [\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n                className: \"track-info\",\n                children: [\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"h3\", {\n                        children: trackName\n                    }, void 0, false, {\n                        fileName: \"/Volumes/Extreme Pro/dauberside.github.io/components/Player.js\",\n                        lineNumber: 71,\n                        columnNumber: 9\n                    }, undefined),\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"p\", {\n                        children: artistName\n                    }, void 0, false, {\n                        fileName: \"/Volumes/Extreme Pro/dauberside.github.io/components/Player.js\",\n                        lineNumber: 72,\n                        columnNumber: 9\n                    }, undefined)\n                ]\n            }, void 0, true, {\n                fileName: \"/Volumes/Extreme Pro/dauberside.github.io/components/Player.js\",\n                lineNumber: 70,\n                columnNumber: 7\n            }, undefined),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n                className: \"controls\",\n                children: [\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"button\", {\n                        onClick: handlePlayPause,\n                        children: isPaused ? \"Play\" : \"Pause\"\n                    }, void 0, false, {\n                        fileName: \"/Volumes/Extreme Pro/dauberside.github.io/components/Player.js\",\n                        lineNumber: 75,\n                        columnNumber: 9\n                    }, undefined),\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"button\", {\n                        onClick: handleNextTrack,\n                        children: \"Next\"\n                    }, void 0, false, {\n                        fileName: \"/Volumes/Extreme Pro/dauberside.github.io/components/Player.js\",\n                        lineNumber: 76,\n                        columnNumber: 9\n                    }, undefined)\n                ]\n            }, void 0, true, {\n                fileName: \"/Volumes/Extreme Pro/dauberside.github.io/components/Player.js\",\n                lineNumber: 74,\n                columnNumber: 7\n            }, undefined)\n        ]\n    }, void 0, true, {\n        fileName: \"/Volumes/Extreme Pro/dauberside.github.io/components/Player.js\",\n        lineNumber: 69,\n        columnNumber: 5\n    }, undefined);\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Player);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9jb21wb25lbnRzL1BsYXllci5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBNEM7QUFFNUMsTUFBTUUsU0FBUyxDQUFDLEVBQUVDLEtBQUssRUFBRTtJQUN2QixNQUFNLENBQUNDLFFBQVFDLFVBQVUsR0FBR0osK0NBQVFBLENBQUM7SUFDckMsTUFBTSxDQUFDSyxVQUFVQyxVQUFVLEdBQUdOLCtDQUFRQSxDQUFDO0lBQ3ZDLE1BQU0sQ0FBQ08sV0FBV0MsYUFBYSxHQUFHUiwrQ0FBUUEsQ0FBQztJQUMzQyxNQUFNLENBQUNTLFlBQVlDLGNBQWMsR0FBR1YsK0NBQVFBLENBQUM7SUFFN0NELGdEQUFTQSxDQUFDO1FBQ1IsTUFBTVksU0FBU0MsU0FBU0MsYUFBYSxDQUFDO1FBQ3RDRixPQUFPRyxHQUFHLEdBQUc7UUFDYkgsT0FBT0ksS0FBSyxHQUFHO1FBQ2ZILFNBQVNJLElBQUksQ0FBQ0MsV0FBVyxDQUFDTjtRQUUxQk8sT0FBT0MsNEJBQTRCLEdBQUc7WUFDcEMsTUFBTWhCLFNBQVMsSUFBSWUsT0FBT0UsT0FBTyxDQUFDbkIsTUFBTSxDQUFDO2dCQUN2Q29CLE1BQU07Z0JBQ05DLGVBQWVDLENBQUFBO29CQUFRQSxHQUFHckI7Z0JBQVE7Z0JBQ2xDc0IsUUFBUTtZQUNWO1lBRUFyQixPQUFPc0IsV0FBVyxDQUFDLFNBQVMsQ0FBQyxFQUFFQyxTQUFTLEVBQUU7Z0JBQ3hDQyxRQUFRQyxHQUFHLENBQUMsd0JBQXdCRjtZQUN0QztZQUVBdkIsT0FBT3NCLFdBQVcsQ0FBQyx3QkFBd0JJLENBQUFBO2dCQUN6QyxJQUFJLENBQUNBLE9BQU87b0JBQ1Y7Z0JBQ0Y7Z0JBRUFyQixhQUFhcUIsTUFBTUMsWUFBWSxDQUFDQyxhQUFhLENBQUNWLElBQUk7Z0JBQ2xEWCxjQUFjbUIsTUFBTUMsWUFBWSxDQUFDQyxhQUFhLENBQUNDLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDQyxDQUFBQSxTQUFVQSxPQUFPYixJQUFJLEVBQUVjLElBQUksQ0FBQztnQkFDdkY3QixVQUFVdUIsTUFBTU8sTUFBTTtnQkFFdEJqQyxPQUFPa0MsZUFBZSxHQUFHQyxJQUFJLENBQUNULENBQUFBO29CQUM1QixJQUFJLENBQUNBLE9BQU87d0JBQ1ZGLFFBQVFZLEtBQUssQ0FBQzt3QkFDZDtvQkFDRjtnQkFDRjtZQUNGO1lBRUFwQyxPQUFPcUMsT0FBTztZQUNkcEMsVUFBVUQ7UUFDWjtJQUNGLEdBQUcsRUFBRTtJQUVMLE1BQU1zQyxrQkFBa0I7UUFDdEIsSUFBSXRDLFFBQVE7WUFDVixJQUFJRSxVQUFVO2dCQUNaRixPQUFPdUMsTUFBTSxHQUFHSixJQUFJLENBQUM7b0JBQ25CaEMsVUFBVTtnQkFDWjtZQUNGLE9BQU87Z0JBQ0xILE9BQU93QyxLQUFLLEdBQUdMLElBQUksQ0FBQztvQkFDbEJoQyxVQUFVO2dCQUNaO1lBQ0Y7UUFDRjtJQUNGO0lBRUEsTUFBTXNDLGtCQUFrQjtRQUN0QixJQUFJekMsUUFBUTtZQUNWQSxPQUFPMEMsU0FBUztRQUNsQjtJQUNGO0lBRUEscUJBQ0UsOERBQUNDO1FBQUlDLElBQUc7OzBCQUNOLDhEQUFDRDtnQkFBSUUsV0FBVTs7a0NBQ2IsOERBQUNDO2tDQUFJMUM7Ozs7OztrQ0FDTCw4REFBQzJDO2tDQUFHekM7Ozs7Ozs7Ozs7OzswQkFFTiw4REFBQ3FDO2dCQUFJRSxXQUFVOztrQ0FDYiw4REFBQ0c7d0JBQU9DLFNBQVNYO2tDQUFrQnBDLFdBQVcsU0FBUzs7Ozs7O2tDQUN2RCw4REFBQzhDO3dCQUFPQyxTQUFTUjtrQ0FBaUI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUkxQztBQUVBLGlFQUFlM0MsTUFBTUEsRUFBQyIsInNvdXJjZXMiOlsid2VicGFjazovL2RhdWJlcnNpZGUuZ2l0aHViLmlvLy4vY29tcG9uZW50cy9QbGF5ZXIuanM/YWFlMyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnO1xuXG5jb25zdCBQbGF5ZXIgPSAoeyB0b2tlbiB9KSA9PiB7XG4gIGNvbnN0IFtwbGF5ZXIsIHNldFBsYXllcl0gPSB1c2VTdGF0ZShudWxsKTtcbiAgY29uc3QgW2lzUGF1c2VkLCBzZXRQYXVzZWRdID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbdHJhY2tOYW1lLCBzZXRUcmFja05hbWVdID0gdXNlU3RhdGUoXCJcIik7XG4gIGNvbnN0IFthcnRpc3ROYW1lLCBzZXRBcnRpc3ROYW1lXSA9IHVzZVN0YXRlKFwiXCIpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3Qgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKTtcbiAgICBzY3JpcHQuc3JjID0gXCJodHRwczovL3Nkay5zY2RuLmNvL3Nwb3RpZnktcGxheWVyLmpzXCI7XG4gICAgc2NyaXB0LmFzeW5jID0gdHJ1ZTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHNjcmlwdCk7XG5cbiAgICB3aW5kb3cub25TcG90aWZ5V2ViUGxheWJhY2tTREtSZWFkeSA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHBsYXllciA9IG5ldyB3aW5kb3cuU3BvdGlmeS5QbGF5ZXIoe1xuICAgICAgICBuYW1lOiAnV2ViIFBsYXliYWNrIFNESyBQbGF5ZXInLFxuICAgICAgICBnZXRPQXV0aFRva2VuOiBjYiA9PiB7IGNiKHRva2VuKTsgfSxcbiAgICAgICAgdm9sdW1lOiAwLjVcbiAgICAgIH0pO1xuXG4gICAgICBwbGF5ZXIuYWRkTGlzdGVuZXIoJ3JlYWR5JywgKHsgZGV2aWNlX2lkIH0pID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1JlYWR5IHdpdGggRGV2aWNlIElEJywgZGV2aWNlX2lkKTtcbiAgICAgIH0pO1xuXG4gICAgICBwbGF5ZXIuYWRkTGlzdGVuZXIoJ3BsYXllcl9zdGF0ZV9jaGFuZ2VkJywgc3RhdGUgPT4ge1xuICAgICAgICBpZiAoIXN0YXRlKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0VHJhY2tOYW1lKHN0YXRlLnRyYWNrX3dpbmRvdy5jdXJyZW50X3RyYWNrLm5hbWUpO1xuICAgICAgICBzZXRBcnRpc3ROYW1lKHN0YXRlLnRyYWNrX3dpbmRvdy5jdXJyZW50X3RyYWNrLmFydGlzdHMubWFwKGFydGlzdCA9PiBhcnRpc3QubmFtZSkuam9pbihcIiwgXCIpKTtcbiAgICAgICAgc2V0UGF1c2VkKHN0YXRlLnBhdXNlZCk7XG5cbiAgICAgICAgcGxheWVyLmdldEN1cnJlbnRTdGF0ZSgpLnRoZW4oc3RhdGUgPT4ge1xuICAgICAgICAgIGlmICghc3RhdGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VzZXIgaXMgbm90IHBsYXlpbmcgbXVzaWMgdGhyb3VnaCB0aGUgV2ViIFBsYXliYWNrIFNESycpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgcGxheWVyLmNvbm5lY3QoKTtcbiAgICAgIHNldFBsYXllcihwbGF5ZXIpO1xuICAgIH07XG4gIH0sIFtdKTtcblxuICBjb25zdCBoYW5kbGVQbGF5UGF1c2UgPSAoKSA9PiB7XG4gICAgaWYgKHBsYXllcikge1xuICAgICAgaWYgKGlzUGF1c2VkKSB7XG4gICAgICAgIHBsYXllci5yZXN1bWUoKS50aGVuKCgpID0+IHtcbiAgICAgICAgICBzZXRQYXVzZWQoZmFsc2UpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBsYXllci5wYXVzZSgpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIHNldFBhdXNlZCh0cnVlKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZU5leHRUcmFjayA9ICgpID0+IHtcbiAgICBpZiAocGxheWVyKSB7XG4gICAgICBwbGF5ZXIubmV4dFRyYWNrKCk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBpZD1cInNwb3RpZnktcGxheWVyXCI+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInRyYWNrLWluZm9cIj5cbiAgICAgICAgPGgzPnt0cmFja05hbWV9PC9oMz5cbiAgICAgICAgPHA+e2FydGlzdE5hbWV9PC9wPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbnRyb2xzXCI+XG4gICAgICAgIDxidXR0b24gb25DbGljaz17aGFuZGxlUGxheVBhdXNlfT57aXNQYXVzZWQgPyAnUGxheScgOiAnUGF1c2UnfTwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9e2hhbmRsZU5leHRUcmFja30+TmV4dDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBQbGF5ZXI7Il0sIm5hbWVzIjpbInVzZUVmZmVjdCIsInVzZVN0YXRlIiwiUGxheWVyIiwidG9rZW4iLCJwbGF5ZXIiLCJzZXRQbGF5ZXIiLCJpc1BhdXNlZCIsInNldFBhdXNlZCIsInRyYWNrTmFtZSIsInNldFRyYWNrTmFtZSIsImFydGlzdE5hbWUiLCJzZXRBcnRpc3ROYW1lIiwic2NyaXB0IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50Iiwic3JjIiwiYXN5bmMiLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJ3aW5kb3ciLCJvblNwb3RpZnlXZWJQbGF5YmFja1NES1JlYWR5IiwiU3BvdGlmeSIsIm5hbWUiLCJnZXRPQXV0aFRva2VuIiwiY2IiLCJ2b2x1bWUiLCJhZGRMaXN0ZW5lciIsImRldmljZV9pZCIsImNvbnNvbGUiLCJsb2ciLCJzdGF0ZSIsInRyYWNrX3dpbmRvdyIsImN1cnJlbnRfdHJhY2siLCJhcnRpc3RzIiwibWFwIiwiYXJ0aXN0Iiwiam9pbiIsInBhdXNlZCIsImdldEN1cnJlbnRTdGF0ZSIsInRoZW4iLCJlcnJvciIsImNvbm5lY3QiLCJoYW5kbGVQbGF5UGF1c2UiLCJyZXN1bWUiLCJwYXVzZSIsImhhbmRsZU5leHRUcmFjayIsIm5leHRUcmFjayIsImRpdiIsImlkIiwiY2xhc3NOYW1lIiwiaDMiLCJwIiwiYnV0dG9uIiwib25DbGljayJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./components/Player.js\n");

/***/ }),

/***/ "./pages/_app.js":
/*!***********************!*\
  !*** ./pages/_app.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _src_styles_globals_css__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../src/styles/globals.css */ \"./src/styles/globals.css\");\n/* harmony import */ var _src_styles_globals_css__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_src_styles_globals_css__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var bootstrap_dist_css_bootstrap_min_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! bootstrap/dist/css/bootstrap.min.css */ \"./node_modules/bootstrap/dist/css/bootstrap.min.css\");\n/* harmony import */ var bootstrap_dist_css_bootstrap_min_css__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(bootstrap_dist_css_bootstrap_min_css__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var next_script__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! next/script */ \"./node_modules/next/script.js\");\n/* harmony import */ var next_script__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(next_script__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var _components_Footer__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../components/Footer */ \"./components/Footer.js\");\n\n\n\n\n\nfunction MyApp({ Component, pageProps }) {\n    const spotifyToken = \"f142c21f4e424c60a8733b678bbcac65\"; // 有効なSpotifyトークンを設定\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, {\n        children: [\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)((next_script__WEBPACK_IMPORTED_MODULE_3___default()), {\n                src: \"https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js\",\n                strategy: \"lazyOnload\"\n            }, void 0, false, {\n                fileName: \"/Volumes/Extreme Pro/dauberside.github.io/pages/_app.js\",\n                lineNumber: 11,\n                columnNumber: 7\n            }, this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n                ...pageProps\n            }, void 0, false, {\n                fileName: \"/Volumes/Extreme Pro/dauberside.github.io/pages/_app.js\",\n                lineNumber: 15,\n                columnNumber: 7\n            }, this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_components_Footer__WEBPACK_IMPORTED_MODULE_4__[\"default\"], {\n                spotifyToken: spotifyToken\n            }, void 0, false, {\n                fileName: \"/Volumes/Extreme Pro/dauberside.github.io/pages/_app.js\",\n                lineNumber: 16,\n                columnNumber: 7\n            }, this)\n        ]\n    }, void 0, true);\n}\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MyApp);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9wYWdlcy9fYXBwLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQW1DO0FBQ1c7QUFDYjtBQUNTO0FBRTFDLFNBQVNFLE1BQU0sRUFBRUMsU0FBUyxFQUFFQyxTQUFTLEVBQUU7SUFDckMsTUFBTUMsZUFBZSxvQ0FBb0Msb0JBQW9CO0lBRTdFLHFCQUNFOzswQkFDRSw4REFBQ0wsb0RBQU1BO2dCQUNMTSxLQUFJO2dCQUNKQyxVQUFTOzs7Ozs7MEJBRVgsOERBQUNKO2dCQUFXLEdBQUdDLFNBQVM7Ozs7OzswQkFDeEIsOERBQUNILDBEQUFNQTtnQkFBQ0ksY0FBY0E7Ozs7Ozs7O0FBRzVCO0FBRUEsaUVBQWVILEtBQUtBLEVBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9kYXViZXJzaWRlLmdpdGh1Yi5pby8uL3BhZ2VzL19hcHAuanM/ZTBhZCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgJy4uL3NyYy9zdHlsZXMvZ2xvYmFscy5jc3MnO1xuaW1wb3J0ICdib290c3RyYXAvZGlzdC9jc3MvYm9vdHN0cmFwLm1pbi5jc3MnO1xuaW1wb3J0IFNjcmlwdCBmcm9tICduZXh0L3NjcmlwdCc7XG5pbXBvcnQgRm9vdGVyIGZyb20gJy4uL2NvbXBvbmVudHMvRm9vdGVyJztcblxuZnVuY3Rpb24gTXlBcHAoeyBDb21wb25lbnQsIHBhZ2VQcm9wcyB9KSB7XG4gIGNvbnN0IHNwb3RpZnlUb2tlbiA9IFwiZjE0MmMyMWY0ZTQyNGM2MGE4NzMzYjY3OGJiY2FjNjVcIjsgLy8g5pyJ5Yq544GqU3BvdGlmeeODiOODvOOCr+ODs+OCkuioreWumlxuXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIDxTY3JpcHRcbiAgICAgICAgc3JjPVwiaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L25wbS9ib290c3RyYXBANS4wLjIvZGlzdC9qcy9ib290c3RyYXAuYnVuZGxlLm1pbi5qc1wiXG4gICAgICAgIHN0cmF0ZWd5PVwibGF6eU9ubG9hZFwiXG4gICAgICAvPlxuICAgICAgPENvbXBvbmVudCB7Li4ucGFnZVByb3BzfSAvPlxuICAgICAgPEZvb3RlciBzcG90aWZ5VG9rZW49e3Nwb3RpZnlUb2tlbn0gLz5cbiAgICA8Lz5cbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgTXlBcHA7Il0sIm5hbWVzIjpbIlNjcmlwdCIsIkZvb3RlciIsIk15QXBwIiwiQ29tcG9uZW50IiwicGFnZVByb3BzIiwic3BvdGlmeVRva2VuIiwic3JjIiwic3RyYXRlZ3kiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./pages/_app.js\n");

/***/ }),

/***/ "./src/styles/globals.css":
/*!********************************!*\
  !*** ./src/styles/globals.css ***!
  \********************************/
/***/ (() => {



/***/ }),

/***/ "next/dist/compiled/next-server/pages.runtime.dev.js":
/*!**********************************************************************!*\
  !*** external "next/dist/compiled/next-server/pages.runtime.dev.js" ***!
  \**********************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/pages.runtime.dev.js");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = require("react");

/***/ }),

/***/ "react-dom":
/*!****************************!*\
  !*** external "react-dom" ***!
  \****************************/
/***/ ((module) => {

"use strict";
module.exports = require("react-dom");

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "react/jsx-runtime":
/*!************************************!*\
  !*** external "react/jsx-runtime" ***!
  \************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-runtime");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/@swc","vendor-chunks/bootstrap"], () => (__webpack_exec__("./pages/_app.js")));
module.exports = __webpack_exports__;

})();