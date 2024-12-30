// @ts-nocheck

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useSpring, useSprings, animated, config } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import useLocalStorage from '@ctatz/uselocalstorage'
import clamp from 'lodash.clamp'
import swap from 'lodash-move'

import gameData from './draggin_config.json'

const fn =
  (order: number[], active = false, originalIndex = 0, curIndex = 0, y = 0) =>
  (index: number) =>
    active && index === originalIndex
      ? {
          y: curIndex * 50 + y,
          scale: 1.1,
          zIndex: 1,
          shadow: 15,
          immediate: (key: string) => key === 'zIndex',
          config: (key: string) => (key === 'y' ? config.stiff : config.default),
        }
      : {
          y: order.indexOf(index) * 50,
          scale: 1,
          zIndex: 0,
          shadow: 1,
          immediate: false,
        }

function DraggableList({ setOrder, items, loadedOrder, setDrags, wrongIndexes, setWrongIndexes, seteventOrder }) {
  const order = useRef(loadedOrder || items.map((_, index) => index)) // Store indicies as a local ref, this represents the item order
  const [springs, api] = useSprings(items.length, fn(order.current), [wrongIndexes]) // Create springs, each corresponds to an item, controlling its transform, scale, etc.
  const bind = useDrag(({ args: [originalIndex], active, movement: [, y] }) => {
    const curIndex = order.current.indexOf(originalIndex)
    const curRow = clamp(Math.round((curIndex * 50 + y) / 50), 0, items.length - 1)
    const newOrder = swap(order.current, curIndex, curRow)
    api.start(fn(newOrder, active, originalIndex, curIndex, y)) // Feed springs new style data, they'll animate the view without causing a single render
    if (!active) {
      if (order.current.toString() !== newOrder.toString()) {
        order.current = newOrder
        localStorage.setItem('currentOrder', JSON.stringify(newOrder))
        setDrags(prev => prev + 1)
        seteventOrder(prev => prev + 'drag,')
        localStorage.setItem('drags', (Number(localStorage.getItem('drags')) || 0) + 1)
        setOrder(newOrder)
        setWrongIndexes([])
      }
    }
  })
  return (
    <div className={`content`} style={{ height: items.length * 50 }}>
      {springs.map(({ zIndex, shadow, y, scale }, i) => (
        <animated.div
          {...bind(i)}
          key={items[i]}
          style={{
            zIndex,
            boxShadow: shadow.to(s => `rgba(0, 0, 0, 0.15) 0px ${s}px ${2 * s}px 0px`),
            y,
            scale,
            background: wrongIndexes.indexOf(i) != -1 ? 'linear-gradient(to top, #eb3349, #f45c43)' : undefined,
          }}>
          {items[i]}
        </animated.div>
      ))}
    </div>
  )
}

export default function Draggin({ opts }) {
  let [drags, setDrags] = useLocalStorage('drags', 0)
  let [tries, setTries] = useLocalStorage('tries', 0)
  let [showHint, setShowHint] = useLocalStorage('showHint', 0)
  let [solved, setSolved] = useLocalStorage('solved', false)
  let [preloadOrder, _] = useLocalStorage('currentOrder', false)
  let [eventOrder, seteventOrder] = useLocalStorage('eventOrder', '')
  let [finalOrder, setFinalOrder] = useState([])
  let [words, setWords] = useState([])
  let [hints, setHints] = useState('')
  let [currentOrder, setcurrentOrder] = useState([])
  let [wrongIndexes, setWrongIndexes] = useState([])
  let [winMessage, setWinMessage] = useState('')
  let [showHelp, setShowHelp] = useState(false)

  let options = useMemo(() => {
    return {
      showIncorrectGuesses: false,
      ...opts,
    }
  }, [opts])

  const [guessSprings, guessApi] = useSpring(() => ({
    from: { x: 0 },
  }))

  useEffect(() => {
    setInitialGameState(gameData.version)

    let day = getDaysSinceStart()
    setFinalOrder(gameData.days[day].final_order)
    setWords(gameData.days[day].words)
    setHints(gameData.days[day].hints)
    setWinMessage(gameData.win_messages[Math.floor(Math.random() * gameData.win_messages.length)])
  }, [])

  const onSubmit = useCallback(() => {
    setTries(prev => prev + 1)
    if (checkOrder(currentOrder, finalOrder)) {
      setSolved(true)
      seteventOrder(prevOrder => prevOrder + 'solved,')
    } else {
      guessApi.start({
        from: {
          x: 0,
        },
        to: [
          { x: 15, borderColor: 'red', config: { duration: 100 } },
          { x: -15, config: { duration: 100 } },
          { x: 0, borderColor: 'black', config: { duration: 100 } },
        ],
      })

      options.showIncorrectGuesses && setWrongIndexes(findWrongIndexes(currentOrder, finalOrder))
      seteventOrder(prevOrder => prevOrder + 'try,')
    }
  }, [tries, currentOrder, finalOrder])

  return (
    <div className="absolute size-full bg-slate-100">
      <div className="mt-[-10px] flex h-full flex-col flex-nowrap content-center items-center justify-center overflow-y-hidden text-slate-800">
        <h1 className="mb-4 text-4xl">Draggin.</h1>
        <p className="">
          Drags {drags} Guesses {tries}
        </p>{' '}
        {/*If using lives: {new Array(3).fill('x').map((_, i) => (i < tries ? '❌' : '🟩'))}*/}
        {words.length && !solved ? (
          <>
            <div className="m-5">
              {hints.map((hint, i) => (
                <>
                  {showHint > i ? (
                    <p key={hint}>{hint}</p>
                  ) : (
                    <p>
                      <a
                        key={hint}
                        className="cursor-pointer border border-dotted border-black p-1 px-4"
                        onClick={() => {
                          seteventOrder(prevOrder => prevOrder + 'hint,')
                          setShowHint(prev => prev + 1)
                        }}>
                        Show Hint {i > 0 && i + 1}
                      </a>
                    </p>
                  )}
                </>
              ))}
            </div>
            <DraggableList
              setOrder={setcurrentOrder}
              items={words}
              loadedOrder={preloadOrder}
              setDrags={setDrags}
              wrongIndexes={wrongIndexes}
              setWrongIndexes={setWrongIndexes}
              seteventOrder={seteventOrder}
            />
            <animated.a
              className="noselect m-4 cursor-pointer border border-dotted border-black p-2 px-6"
              onClick={onSubmit}
              style={{ ...guessSprings }}>
              GUESS
            </animated.a>
            <a className="m-1 cursor-pointer text-xs" onClick={() => setShowHelp(prev => !prev)}>
              How to play
            </a>
            {showHelp && (
              <div className="w-[300px] text-center">
                <p>
                  Drag individual words into their correct order, if you can&apos;t figure out the order theme use a
                  hint!
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <div>{winMessage}</div>
            <div className="m-10 flex max-w-[420px] overflow-hidden break-all text-center text-[2rem] leading-10">
              {generateSolvedString(eventOrder)}
            </div>
            <a
              className="noselect m-4 cursor-pointer border border-dotted border-black p-2 px-6"
              onClick={() => generateShare()}>
              SHARE
            </a>
          </>
        )}
        <div className="absolute bottom-2 text-center">
          <p>
            <a
              href="https://patreon.com/CTatz?utm_medium=unknown&utm_source=join_link&utm_campaign=creatorshare_creator&utm_content=copyLink"
              target="_blank"
              className="mx-auto font-bold">
              Support me on Patreon!
            </a>
          </p>
          <p>
            <a href="/" className="mx-auto">
              ctatz.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

function setInitialGameState(version) {
  if (
    (localStorage.getItem('lastDate') || '') !== buildDate(new Date()) ||
    (localStorage.getItem('version') || '') !== version
  ) {
    localStorage.setItem('version', version)
    localStorage.setItem('lastDate', buildDate(new Date()))
    localStorage.setItem('currentOrder', JSON.stringify(false))
    localStorage.setItem('showHint', 0)
    localStorage.setItem('drags', JSON.stringify(false))
    localStorage.setItem('tries', JSON.stringify(0))
    localStorage.setItem('eventOrder', '')
    localStorage.setItem('solved', JSON.stringify(false))
    let priors = JSON.parse(localStorage.getItem('priors'))
    let newDay = {
      date: buildDate(new Date()),
      solved: false,
    }
    if (!priors) {
      localStorage.setItem('priors', JSON.stringify([newDay]))
    } else {
      priors.push(newDay)
      localStorage.setItem('priors', JSON.stringify(priors))
    }
  }
}

function getDaysSinceStart() {
  const oneDay = 24 * 60 * 60 * 1000 // hours*minutes*seconds*milliseconds
  const firstDate = new Date()
  const secondDate = new Date(gameData.start_date)
  return Math.round(Math.abs((firstDate - secondDate) / oneDay) - 1)
}

function buildDate(date) {
  return (date.getMonth() + 1).toString() + '/' + date.getDate().toString() + '/' + date.getFullYear().toString()
}

function findWrongIndexes(cur, final) {
  return new Array(final.length)
    .fill(0)
    .map((_, idx) => final[idx])
    .filter((_, idx) => cur[idx] !== final[idx])
}

function generateSolvedString(eventOrder) {
  const emojiMap = {
    drag: '👆',
    try: '❌',
    solved: '🎉',
    hint: '🔎',
  }
  return (eventOrder || '')
    .split(',')
    .map(str => emojiMap[str])
    .join('')
}

function checkOrder(currentOrder, finalOrder) {
  return currentOrder.toString() === finalOrder.toString()
}

function generateShare() {
  navigator.clipboard.writeText(`ctatz.com/draggin - Day ${getDaysSinceStart()}\n${generateSolvedString().join('')}`)
  alert('Copied share text to clipboard! Thanks for playing!')
}
